import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, timeout, TimeoutError } from 'rxjs';
import { GeminiService, Message } from '../../services/gemini.service';

export interface FvmQuestion {
  id: string;
  section: 'Assumptions' | 'Magnitudes';
  shortLabel: string;
  fullQuestion: string;
}

export const FVM_QUESTIONS: FvmQuestion[] = [
  // ── Assumptions ───────────────────────────────────────────────────────────
  { id: 'a1',  section: 'Assumptions', shortLabel: 'CSAT → ARPU lift',               fullQuestion: "We're currently assuming $0.20 annual ARPU lift per customer for every 1 basis point improvement in CSAT. Does that sound right to you, and what would you recommend?" },
  { id: 'a2',  section: 'Assumptions', shortLabel: 'Engagement → ARPU lift',         fullQuestion: "We're currently assuming $0.02 annual ARPU lift per customer for every 1 basis point improvement in app engagement. Does that sound right to you, and what would you recommend?" },
  { id: 'a3',  section: 'Assumptions', shortLabel: 'Cost per support contact',        fullQuestion: "We're currently using $5.07 as the fully loaded average cost per support contact (sourced from the SHM monthly report). Does that align with what you're seeing, and what would you suggest?" },
  { id: 'a4',  section: 'Assumptions', shortLabel: 'Wireless postpaid ARPU',          fullQuestion: "We're currently using $57/month as the average ARPU for wireless postpaid per line. What would you use, and why?" },
  { id: 'a5',  section: 'Assumptions', shortLabel: 'Fiber ARPU',                      fullQuestion: "We're currently using $65/month as the average ARPU for Fiber per subscriber. What would you use, and why?" },
  { id: 'a6',  section: 'Assumptions', shortLabel: 'AIA ARPU',                        fullQuestion: "We're currently using $55/month as the average ARPU for AIA per subscriber. What would you use, and why?" },
  { id: 'a7',  section: 'Assumptions', shortLabel: 'Second service revenue',          fullQuestion: "We're currently assuming $45/month in incremental revenue when a customer adds a second AT&T service. Does that feel accurate, and what's your read?" },
  { id: 'a8',  section: 'Assumptions', shortLabel: 'Upsell / add-on value',           fullQuestion: "We're currently using $8/month as the average value of an upsell or add-on per customer. What would you recommend, and what drives that number for you?" },
  { id: 'a9',  section: 'Assumptions', shortLabel: 'At-risk churn rate',              fullQuestion: "We're currently assuming 1% of the eligible base is at risk of churning at any given time. Does that reflect your experience, and what would you change?" },
  { id: 'a10', section: 'Assumptions', shortLabel: 'Single-service base',             fullQuestion: "We're currently assuming 60% of the eligible base is single-service (i.e., not yet converged), sourced from the BC. Does that track, and what's your current view?" },
  { id: 'a11', section: 'Assumptions', shortLabel: 'Support contact rate',            fullQuestion: "We're currently assuming 0.8 support contacts per customer per year as the baseline contact rate. What would you use, and what's driving that for you?" },
  { id: 'a12', section: 'Assumptions', shortLabel: 'Digital transaction savings',     fullQuestion: "We're currently estimating $12 in savings per transaction shifted from retail to digital. Does that feel right, and what would you use?" },
  { id: 'a13', section: 'Assumptions', shortLabel: 'Retail transactions per customer',fullQuestion: "We're currently assuming 0.3 retail transactions per customer per year. What's your estimate, and what's that based on?" },
  { id: 'a14', section: 'Assumptions', shortLabel: 'Resource cost per day',           fullQuestion: "We're currently using $360/day as the fully loaded resource cost to build a feature. What would you recommend, and how are you thinking about that?" },
  { id: 'a15', section: 'Assumptions', shortLabel: 'Feature build time range',        fullQuestion: "We're currently modeling feature build time as 0 to 5 weeks. Does that match your teams' experience, and what range would you suggest?" },

  // ── Magnitudes ────────────────────────────────────────────────────────────
  { id: 'm1',  section: 'Magnitudes',  shortLabel: 'Gross adds lift',                 fullQuestion: "For features customers actually adopt, we're currently modeling a gross adds lift of 0 to 0.3% of adopting customers. What magnitude have you seen in practice, and what would you recommend?" },
  { id: 'm2',  section: 'Magnitudes',  shortLabel: 'Convergence uplift',              fullQuestion: "For convergence uplift, we're modeling 0 to 0.3% of adopting customers converting from single- to multi-service. Does that feel like the right range to you?" },
  { id: 'm3',  section: 'Magnitudes',  shortLabel: 'Churn save rate',                 fullQuestion: "For churn saves, we're modeling a 0 to 15% reduction in churn attributable to a feature. What range reflects your experience?" },
  { id: 'm4',  section: 'Magnitudes',  shortLabel: 'ARPU expansion',                  fullQuestion: "For ARPU expansion through add-ons, upsells, or upgrades, we're using 0 to 2%. What would you peg this at, and why?" },
  { id: 'm5',  section: 'Magnitudes',  shortLabel: 'Call shed',                       fullQuestion: "For call shed, we're modeling 0 to 20% of inbound support contacts deflected by a feature. What range would you use?" },
  { id: 'm6',  section: 'Magnitudes',  shortLabel: 'Digital sales shift',             fullQuestion: "For digital sales shift, we're modeling 0 to 20% of retail transactions moving to digital through a feature. Does that feel right?" },
  { id: 'm7',  section: 'Magnitudes',  shortLabel: 'CX uplift (CSAT bps)',            fullQuestion: "For customer experience uplift, we're modeling 0 to 0.6 basis points of CSAT improvement per feature. What's your sense of a realistic range?" },
  { id: 'm8',  section: 'Magnitudes',  shortLabel: 'Friction reduction (CSAT bps)',   fullQuestion: "For friction reduction, we're also modeling 0 to 0.6 basis points of CSAT improvement. Does that align with what you'd expect, and would you separate it from experience uplift?" },
  { id: 'm9',  section: 'Magnitudes',  shortLabel: 'Engagement → revenue conversion', fullQuestion: "We don't yet have a way to translate MAU or DAU/MAU engagement metrics into dollar value. How would you approach converting engagement signals into revenue impact?" },
  { id: 'm10', section: 'Magnitudes',  shortLabel: 'Story points → cost',             fullQuestion: "We don't currently have a conversion from story points to dollar value. How would you translate a story point estimate into a cost or effort value?" },
  { id: 'm11', section: 'Magnitudes',  shortLabel: 'T-shirt sizing → cost',           fullQuestion: "We don't currently have a dollar mapping for T-shirt sizing. How would you assign a dollar value to each T-shirt size — S, M, L, XL — for feature build effort?" },
];

export enum FvmPhase {
  Start     = 1,
  Interview = 2,
  Send      = 3,
  Sent      = 4
}

@Component({
  selector: 'app-fvm-data-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fvm-data-request.html',
  styleUrl: './fvm-data-request.scss'
})
export class FvmDataRequestComponent implements OnInit, OnDestroy, AfterViewChecked {
  private gemini = inject(GeminiService);
  private http   = inject(HttpClient);

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  FvmPhase      = FvmPhase;
  phase         = FvmPhase.Start;
  questions     = FVM_QUESTIONS;

  // Start screen
  interviewerName = '';
  respondentName  = '';
  respondentRole  = '';

  // Interview state
  messages: Message[]           = [];
  answers: Record<string, string> = {};
  userInput  = '';
  isLoading  = false;
  isStuck    = false;
  started    = false;

  private activeCall:      Subscription | null = null;
  private pendingMessages: string[] = [];
  private scrollPending    = false;
  private readonly AI_TIMEOUT_MS = 25000;

  // Send state
  recipientEmail   = '';
  isSendingReport  = false;
  isGeneratingReport = false;
  linkCopied       = false;

  private readonly apiBase = 'https://industrial-ml-api.azurewebsites.net';

  // ── Computed ──────────────────────────────────────────────────────────────
  get answeredCount()   { return Object.keys(this.answers).length; }
  get totalQuestions()  { return this.questions.length; }
  get progressPercent() { return Math.round(this.answeredCount / this.totalQuestions * 100); }
  get assumptionsDone() { return this.questions.filter(q => q.section === 'Assumptions' && this.answers[q.id]).length; }
  get magnitudesDone()  { return this.questions.filter(q => q.section === 'Magnitudes'  && this.answers[q.id]).length; }
  get allDone()         { return this.answeredCount === this.totalQuestions; }

  isAnswered(q: FvmQuestion) { return !!this.answers[q.id]; }

  get systemPrompt(): string {
    const qList = this.questions.map((q, i) =>
      `${i + 1}. (capture-id: ${q.id}) ${q.fullQuestion}`
    ).join('\n\n');

    return `You are conducting a structured FVM (Feature Value Matrix) assumptions validation interview on behalf of ${this.interviewerName}. You are speaking with ${this.respondentName}, ${this.respondentRole}.

Your role is to go through each question below one at a time, in order, in a professional and collaborative tone. These are senior business experts — accept concise answers including short numbers or ranges.

QUESTIONS TO COVER (ask in this exact order):
${qList}

RULES:
1. Ask one question at a time. Read the question naturally — do NOT include "capture-id" or any ID code in what you say to the respondent.
2. Accept any answer — a number, a range, "sounds right", or "I'd use X instead" are all valid. Do NOT demand elaboration if the respondent has given a clear position.
3. When you have any answer (even a short one), immediately output a capture tag on its own line:
   ##FVM:a1=<their answer>##
   Use the exact capture-id from the question. Capture their exact words or numbers.
4. After tagging, acknowledge in one sentence, then ask the next question.
5. Never re-ask a captured question.
6. Once all 26 questions are answered, congratulate them briefly.
7. Keep your responses to 2 sentences maximum.`;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {}

  ngOnDestroy() {
    this.activeCall?.unsubscribe();
  }

  ngAfterViewChecked() {
    if (this.scrollPending) {
      try {
        if (this.chatContainer) {
          this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
        }
      } catch (e) {}
      this.scrollPending = false;
    }
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  startInterview() {
    if (!this.interviewerName.trim() || !this.respondentName.trim() || !this.respondentRole.trim()) return;
    this.started = true;
    this.phase   = FvmPhase.Interview;
    const intro  = `Hello, I'm ready to begin the FVM assumptions validation session.`;
    this.messages.push({ role: 'user', text: intro });
    this.scrollPending = true;
    this.callAI();
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  sendMessage() {
    if (!this.userInput.trim()) return;
    const text    = this.userInput.trim();
    this.userInput = '';

    if (this.isLoading) {
      this.pendingMessages.push(text);
      this.messages.push({ role: 'user', text });
      this.scrollPending = true;
      return;
    }

    this.isStuck = false;
    this.messages.push({ role: 'user', text });
    this.scrollPending = true;
    this.callAI();
  }

  callAI() {
    this.activeCall?.unsubscribe();
    this.isLoading = true;
    this.isStuck   = false;

    this.activeCall = this.gemini
      .sendMessageWithSystemPrompt(this.messages, this.systemPrompt)
      .pipe(timeout(this.AI_TIMEOUT_MS))
      .subscribe({
        next: (res: any) => {
          const raw = res.choices[0].message.content;
          this.parseAnswers(raw);
          const display = raw.replace(/##FVM:[^#]+##/g, '').trim();
          this.messages.push({ role: 'model', text: display });
          this.scrollPending = true;
          this.isLoading  = false;
          this.activeCall = null;

          if (this.pendingMessages.length > 0) {
            this.pendingMessages = [];
            this.callAI();
          }
        },
        error: (err: any) => {
          this.isLoading  = false;
          this.activeCall = null;
          this.pendingMessages = [];
          if (err instanceof TimeoutError) {
            this.isStuck = true;
          } else {
            this.messages.push({ role: 'model', text: 'Sorry, I encountered an error. Please try again.' });
          }
          this.scrollPending = true;
        }
      });
  }

  retryAI() {
    this.isStuck = false;
    this.callAI();
  }

  parseAnswers(text: string) {
    const regex = /##FVM:([a-z0-9]+)\s*=\s*([^#\n]+)##/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      this.answers[match[1].trim().toLowerCase()] = match[2].trim();
    }
  }

  onKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
  }

  // ── Send report ───────────────────────────────────────────────────────────
  proceedToSend() {
    this.phase = FvmPhase.Send;
  }

  sendReport() {
    if (!this.recipientEmail.trim() || this.isSendingReport) return;
    this.isSendingReport    = true;
    this.isGeneratingReport = true;

    // Build AI summary prompt
    const answeredRows = this.questions
      .filter(q => this.answers[q.id])
      .map(q => `[${q.section}] ${q.shortLabel}: ${this.answers[q.id]}`)
      .join('\n');

    const summaryPrompt = `You are summarising an FVM (Feature Value Matrix) assumptions validation interview conducted with ${this.respondentName}, ${this.respondentRole}.

CAPTURED RESPONSES:
${answeredRows}

Write a concise executive summary (3–5 sentences) covering: key agreements with current assumptions, notable recommendations for changes, and any significant new insights provided. Be specific — include numbers where relevant. Address the summary to the interviewer (${this.interviewerName}).`;

    const summaryMsgs: Message[] = [{ role: 'user', text: summaryPrompt }];
    const summarySys = 'You write concise executive summaries of business interviews. Be specific and include numbers.';

    const summaryTimeout = setTimeout(() => {
      this.isGeneratingReport = false;
      this.dispatchEmail('');
    }, 12000);

    this.gemini.sendMessageWithSystemPrompt(summaryMsgs, summarySys).subscribe({
      next: (res: any) => {
        clearTimeout(summaryTimeout);
        this.isGeneratingReport = false;
        const summary = res.choices[0].message.content ?? '';
        this.dispatchEmail(summary);
      },
      error: () => {
        clearTimeout(summaryTimeout);
        this.isGeneratingReport = false;
        this.dispatchEmail('');
      }
    });
  }

  private dispatchEmail(summary: string) {
    const responses: { question: string; answer: string }[] = [
      ...(summary ? [{ question: 'Executive Summary', answer: summary }] : []),
      ...this.questions.map(q => ({
        question: `[${q.section}] ${q.shortLabel} — ${q.fullQuestion}`,
        answer:   this.answers[q.id] || '(not answered)'
      }))
    ];

    this.http.post(`${this.apiBase}/api/email/send-responses`, {
      to:        this.recipientEmail,
      formTitle: `FVM Assumptions Validation — ${this.respondentName} (${this.respondentRole})`,
      responses
    }).subscribe({
      next:  () => { this.isSendingReport = false; this.phase = FvmPhase.Sent; },
      error: () => { this.isSendingReport = false; this.phase = FvmPhase.Sent; }
    });
  }

  get sendBtnLabel(): string {
    if (this.isGeneratingReport) return 'Generating summary…';
    if (this.isSendingReport)    return 'Sending…';
    return 'Send Report →';
  }

  startOver() {
    this.activeCall?.unsubscribe();
    this.activeCall      = null;
    this.phase           = FvmPhase.Start;
    this.messages        = [];
    this.answers         = {};
    this.userInput       = '';
    this.isLoading       = false;
    this.isStuck         = false;
    this.started         = false;
    this.pendingMessages = [];
    this.interviewerName = '';
    this.respondentName  = '';
    this.respondentRole  = '';
    this.recipientEmail  = '';
    this.isSendingReport = false;
  }
}
