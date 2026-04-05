import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, Message } from '../../services/gemini.service';

export interface ProgressField {
  key: string;
  label: string;
  description: string;
  value: string | null;
}

@Component({
  selector: 'app-interview-tool',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './interview-tool.html',
  styleUrl: './interview-tool.scss'
})
export class InterviewToolComponent implements OnInit, AfterViewChecked {
  private gemini = inject(GeminiService);

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  messages: Message[] = [];
  userInput = '';
  isLoading = false;
  interviewComplete = false;
  sessionId = '';
  interviewerName = '';
  featureName = '';
  started = false;

  progressFields: ProgressField[] = [
    { key: 'DESCRIPTION', label: 'Feature Description', description: 'What the feature does', value: null },
    { key: 'V1', label: 'Revenue Model', description: '0=None, 1=Ad-hoc, 2=Annual sub, 3=Monthly sub', value: null },
    { key: 'V3', label: 'Functional Pain', description: '0=None, 1=Minor, 2=Moderate, 3=Severe', value: null },
    { key: 'V5', label: 'Competitive Gap', description: '0=N/A, 1=Behind, 2=Parity, 3=Leads', value: null },
    { key: 'E1', label: 'Engineering Capacity', description: '1=Low, 2=Medium, 3=High', value: null },
    { key: 'E6', label: 'Engineering Duration', description: '0=≤1wk, 1=2-3wk, 2=4-6wk, 3=6+wk', value: null },
    { key: 'M4', label: 'Strategic Category', description: '1=Table Stakes, 2=Core, 3=Revenue Expansion', value: null },
  ];

  get answeredCount() {
    return this.progressFields.filter(f => f.value !== null).length;
  }

  get progressPercent() {
    return Math.round((this.answeredCount / this.progressFields.length) * 100);
  }

  ngOnInit() {
    this.sessionId = Date.now().toString();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop =
          this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (e) {}
  }

  startInterview() {
    if (!this.interviewerName || !this.featureName) return;
    this.started = true;
    const intro = `Hi, I am ${this.interviewerName} and I would like to start a feature evaluation. The feature name is "${this.featureName}". Please ask me for the feature description first.`;
    this.messages.push({ role: 'user', text: intro });
    this.callGemini();
  }

  sendMessage() {
    if (!this.userInput.trim() || this.isLoading) return;
    const text = this.userInput.trim();
    this.userInput = '';
    this.messages.push({ role: 'user', text });
    this.callGemini();
  }

  callGemini() {
    this.isLoading = true;
    const captured = this.progressFields
      .filter(f => f.value !== null)
      .reduce((acc, f) => ({ ...acc, [f.key]: f.value! }), {} as Record<string, string>);

    this.gemini.sendMessage(this.messages, captured).subscribe({
      next: (response: any) => {
        const text = response.choices[0].message.content;
        this.parseCapturedFields(text);
        const displayText = text.replace(/##CAPTURED:[^#]+##/g, '').trim();
        this.isLoading = false;

        // Only complete when ALL 7 fields are actually filled - ignore AI's INTERVIEW_COMPLETE
        if (this.answeredCount === this.progressFields.length && !this.interviewComplete) {
          this.interviewComplete = true;
          this.messages.push({ role: 'model', text: displayText });
          this.messages.push({
            role: 'model',
            text: `Thank you, ${this.interviewerName}! All 7 fields for "${this.featureName}" have been recorded. Your evaluation is complete.`
          });
          this.saveSession(text);
          return;
        }

        // Strip INTERVIEW_COMPLETE from display if AI says it prematurely
        this.messages.push({ role: 'model', text: displayText.replace(/INTERVIEW_COMPLETE/g, '').trim() });
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        this.messages.push({
          role: 'model',
          text: 'Sorry, I encountered an error. Please try again.'
        });
      }
    });
  }

  parseCapturedFields(text: string) {
    const regex = /##CAPTURED:([A-Z0-9]+)=([^#]+)##/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      const field = this.progressFields.find(f => f.key === key);
      if (field) field.value = value;
    }
  }

  saveSession(summaryText: string) {
    const session = {
      sessionId: this.sessionId,
      interviewerName: this.interviewerName,
      featureName: this.featureName,
      timestamp: new Date().toISOString(),
      fields: this.progressFields.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {}),
      messages: this.messages,
      summary: summaryText
    };
    const sessions = JSON.parse(localStorage.getItem('fvm_sessions') || '[]');
    sessions.push(session);
    localStorage.setItem('fvm_sessions', JSON.stringify(sessions));
  }

  exportTranscript() {
    const content = this.messages
      .map(m => `${m.role === 'user' ? this.interviewerName : 'AI'}: ${m.text}`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FVM_Interview_${this.featureName}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  }

  newInterview() {
    this.messages = [];
    this.userInput = '';
    this.isLoading = false;
    this.interviewComplete = false;
    this.interviewerName = '';
    this.featureName = '';
    this.started = false;
    this.sessionId = Date.now().toString();
    this.progressFields.forEach(f => f.value = null);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
