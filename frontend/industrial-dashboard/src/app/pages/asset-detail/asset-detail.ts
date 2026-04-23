import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, Asset } from '../../services/api.service';
import { GeminiService, Message } from '../../services/gemini.service';

export interface CalcParam {
  key: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  normalMin: number;
  normalMax: number;
}

export interface AiPrediction {
  healthScore: number;
  efficiency: number;
  rulDays: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  insight: string;
}

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asset-detail.html',
  styleUrl: './asset-detail.scss'
})
export class AssetDetailComponent implements OnInit, OnDestroy {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(ApiService);
  private gemini = inject(GeminiService);

  asset: Asset | null = null;
  lastUpdated = new Date();

  // ── Live metrics ──────────────────────────────────────────────────────────
  flowRate      = 42.5;
  motorCurrent  = 21.3;
  bearingTemp   = 58.2;
  efficiency    = 71.8;
  healthScore   = 76.4;
  rulDays       = 147;

  flowHistory:       number[] = [];
  currentHistory:    number[] = [];
  tempHistory:       number[] = [];
  efficiencyHistory: number[] = [];

  private simInterval: any = null;

  // ── AI Calculator ─────────────────────────────────────────────────────────
  calcParams: CalcParam[] = [
    { key: 'flowRate',     label: 'Flow Rate',           unit: 'L/s',    value: 42.5, min: 0,  max: 100, step: 0.5, normalMin: 30, normalMax: 60 },
    { key: 'motorCurrent', label: 'Motor Current',        unit: 'A',      value: 21.3, min: 0,  max: 50,  step: 0.5, normalMin: 15, normalMax: 30 },
    { key: 'bearingTemp',  label: 'Bearing Temperature',  unit: '°C',     value: 58.2, min: 20, max: 100, step: 1,   normalMin: 40, normalMax: 70 },
    { key: 'opHours',      label: 'Operating Hours/Day',  unit: 'hrs',    value: 16,   min: 1,  max: 24,  step: 1,   normalMin: 8,  normalMax: 20 },
    { key: 'maintAge',     label: 'Maintenance Age',      unit: 'months', value: 8,    min: 0,  max: 36,  step: 1,   normalMin: 0,  normalMax: 18 },
    { key: 'vibration',    label: 'Vibration Level',      unit: 'mm/s',   value: 2.8,  min: 0,  max: 20,  step: 0.1, normalMin: 0,  normalMax: 4.5 },
  ];

  aiPrediction:   AiPrediction | null = null;
  isCalculating   = false;
  calcStuck       = false;
  hasCalculated   = false;

  private calcDebounce: any        = null;
  private calcTimeout:  any        = null;
  private calcCall: Subscription | null = null;
  private draggedIndex: number | null  = null;
  private readonly CALC_TIMEOUT_MS = 15000;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    const id = +(this.route.snapshot.paramMap.get('id') ?? '1');
    this.api.getAsset(id).subscribe({ next: a => this.asset = a, error: () => {} });
    this.initSparklines();
    this.startSimulation();
    this.runAICalculation();
  }

  ngOnDestroy() {
    clearInterval(this.simInterval);
    clearTimeout(this.calcDebounce);
    clearTimeout(this.calcTimeout);
    this.calcCall?.unsubscribe();
  }

  // ── Synthetic data simulation ──────────────────────────────────────────────
  private initSparklines() {
    for (let i = 0; i < 30; i++) {
      this.flowHistory.push(      this.flowRate     + (Math.random() - 0.5) * 5);
      this.currentHistory.push(   this.motorCurrent + (Math.random() - 0.5) * 3);
      this.tempHistory.push(      this.bearingTemp  + (Math.random() - 0.5) * 4);
      this.efficiencyHistory.push(this.efficiency   + (Math.random() - 0.5) * 3);
    }
  }

  private startSimulation() {
    this.simInterval = setInterval(() => {
      this.flowRate     = this.drift(this.flowRate,     42.5, 30,  60,  0.8);
      this.motorCurrent = this.drift(this.motorCurrent, 21.3, 15,  30,  0.5);
      this.bearingTemp  = this.drift(this.bearingTemp,  58.2, 40,  72,  0.6);
      this.efficiency   = this.drift(this.efficiency,   71.8, 60,  80,  0.4);
      this.healthScore  = this.drift(this.healthScore,  76.4, 50,  95,  0.25);
      this.rulDays      = Math.max(0, Math.round(this.drift(this.rulDays, 147, 80, 200, 0.5)));

      this.push(this.flowHistory,       this.flowRate);
      this.push(this.currentHistory,    this.motorCurrent);
      this.push(this.tempHistory,       this.bearingTemp);
      this.push(this.efficiencyHistory, this.efficiency);

      this.lastUpdated = new Date();
    }, 2000);
  }

  private drift(v: number, mean: number, min: number, max: number, noise: number): number {
    const pull   = (mean - v) * 0.07;
    const random = (Math.random() - 0.5) * 2 * noise;
    return Math.max(min, Math.min(max, v + pull + random));
  }

  private push(arr: number[], val: number) {
    arr.push(val);
    if (arr.length > 30) arr.shift();
  }

  // ── Sparkline SVG paths ───────────────────────────────────────────────────
  sparklinePath(history: number[], min: number, max: number): string {
    if (history.length < 2) return '';
    const w = 90, h = 30;
    const range = (max - min) || 1;
    return history.map((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${(Math.max(1, Math.min(h - 1, y))).toFixed(1)}`;
    }).join(' ');
  }

  // ── Health gauge SVG arc ──────────────────────────────────────────────────
  gaugeArc(pct: number): string {
    const clamp = Math.max(0.01, Math.min(0.999, pct));
    const startAngle = 135;
    const endAngle   = startAngle + clamp * 270;
    const toRad      = (d: number) => d * Math.PI / 180;
    const cx = 100, cy = 100, r = 76;
    const sx = cx + r * Math.cos(toRad(startAngle));
    const sy = cy + r * Math.sin(toRad(startAngle));
    const ex = cx + r * Math.cos(toRad(endAngle));
    const ey = cy + r * Math.sin(toRad(endAngle));
    const large = clamp * 270 > 180 ? 1 : 0;
    return `M ${sx.toFixed(2)},${sy.toFixed(2)} A ${r},${r} 0 ${large} 1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
  }

  get healthGaugeBg(): string   { return this.gaugeArc(1); }
  get healthGaugeVal(): string  { return this.gaugeArc(this.healthScore / 100); }

  get healthColor(): string {
    if (this.healthScore >= 80) return '#16a34a';
    if (this.healthScore >= 60) return '#d97706';
    return '#dc2626';
  }

  get statusLabel(): string {
    if (this.healthScore >= 80) return 'NORMAL';
    if (this.healthScore >= 60) return 'WARNING';
    return 'CRITICAL';
  }

  get statusClass(): string {
    if (this.healthScore >= 80) return 'status-normal';
    if (this.healthScore >= 60) return 'status-warning';
    return 'status-critical';
  }

  tempStatus(): 'ok' | 'warn' | 'alarm' {
    if (this.bearingTemp > 75) return 'alarm';
    if (this.bearingTemp > 65) return 'warn';
    return 'ok';
  }

  // ── AI Calculator ─────────────────────────────────────────────────────────
  onParamChange() {
    clearTimeout(this.calcDebounce);
    this.calcDebounce = setTimeout(() => this.runAICalculation(), 800);
  }

  runAICalculation() {
    this.calcCall?.unsubscribe();
    this.isCalculating = true;
    this.calcStuck     = false;

    clearTimeout(this.calcTimeout);
    this.calcTimeout = setTimeout(() => {
      if (this.isCalculating) {
        this.calcCall?.unsubscribe();
        this.calcCall      = null;
        this.isCalculating = false;
        this.calcStuck     = true;
      }
    }, this.CALC_TIMEOUT_MS);

    const liveCtx = `Live sensor readings right now — Flow Rate: ${this.flowRate.toFixed(1)} L/s, Motor Current: ${this.motorCurrent.toFixed(1)} A, Bearing Temperature: ${this.bearingTemp.toFixed(1)} °C, Pump Efficiency: ${this.efficiency.toFixed(1)}%, Current Health Score: ${this.healthScore.toFixed(0)}%.`;

    const params = this.calcParams
      .map(p => `- ${p.label}: ${p.value} ${p.unit} (normal ${p.normalMin}–${p.normalMax})`)
      .join('\n');

    const prompt = `You are an industrial pump health AI for a wastewater treatment influent pump. ${liveCtx}

The operator wants to model a scenario with these parameters:
${params}

Analyse the scenario: values outside normal ranges degrade health and efficiency; high vibration and bearing temperature are leading failure indicators; excessive operating hours and long maintenance intervals accelerate wear; combined stress factors compound degradation non-linearly.

Return ONLY this exact JSON object (no markdown, no explanation):
{"healthScore":75,"efficiency":68,"rulDays":132,"riskLevel":"moderate","insight":"2–3 sentence analysis of the key risk factors driving this prediction and the most important action to take."}`;

    const msgs: Message[] = [{ role: 'user', text: prompt }];
    const sys = 'You are an industrial pump health prediction engine. Output only valid JSON matching the schema provided. No markdown fences, no explanation.';

    this.calcCall = this.gemini.sendMessageWithSystemPrompt(msgs, sys).subscribe({
      next: (res: any) => {
        clearTimeout(this.calcTimeout);
        const raw = res.choices[0].message.content;
        try {
          const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const match = clean.match(/\{[\s\S]*\}/);
          if (match) this.aiPrediction = JSON.parse(match[0]);
        } catch {}
        this.isCalculating = false;
        this.hasCalculated = true;
        this.calcCall      = null;
      },
      error: () => {
        clearTimeout(this.calcTimeout);
        this.isCalculating = false;
        this.calcCall      = null;
        this.calcStuck     = true;
      }
    });
  }

  retryCalc() {
    this.calcStuck = false;
    this.runAICalculation();
  }

  // ── Drag to reorder ────────────────────────────────────────────────────────
  onDragStart(i: number) {
    this.draggedIndex = i;
  }

  onDragOver(event: DragEvent, i: number) {
    event.preventDefault();
  }

  onDrop(i: number) {
    if (this.draggedIndex === null || this.draggedIndex === i) {
      this.draggedIndex = null;
      return;
    }
    const arr = [...this.calcParams];
    const [item] = arr.splice(this.draggedIndex, 1);
    arr.splice(i, 0, item);
    this.calcParams   = arr;
    this.draggedIndex = null;
  }

  onDragEnd() {
    this.draggedIndex = null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  sliderFill(p: CalcParam): string {
    return ((p.value - p.min) / (p.max - p.min) * 100).toFixed(1) + '%';
  }

  isAboveNormal(p: CalcParam): boolean { return p.value > p.normalMax; }
  isBelowNormal(p: CalcParam): boolean { return p.value < p.normalMin; }

  get predHealthColor(): string {
    if (!this.aiPrediction) return '#64748b';
    const s = this.aiPrediction.healthScore;
    if (s >= 80) return '#16a34a';
    if (s >= 60) return '#d97706';
    return '#dc2626';
  }

  get predRiskColor(): string {
    const r = this.aiPrediction?.riskLevel;
    if (r === 'low')      return '#16a34a';
    if (r === 'moderate') return '#d97706';
    if (r === 'high')     return '#ea580c';
    return '#dc2626';
  }

  get predRulColor(): string {
    const d = this.aiPrediction?.rulDays ?? 999;
    if (d >= 180) return '#16a34a';
    if (d >= 90)  return '#d97706';
    return '#dc2626';
  }

  rulLabel(days: number): string {
    if (days >= 365) return `${Math.round(days / 30)} months`;
    return `${days} days`;
  }

  goBack() { this.router.navigate(['/']); }
}
