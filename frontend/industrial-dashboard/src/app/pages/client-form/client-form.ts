import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { GeminiService, Message } from '../../services/gemini.service';
import { FormDefinition, FormQuestion, StoredForm } from '../client-data-collector/client-data-collector';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-form.html',
  styleUrl: './client-form.scss'
})
export class ClientFormComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private gemini = inject(GeminiService);
  private http = inject(HttpClient);

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  form: FormDefinition | null = null;
  formData: Record<string, any> = {};
  submitted = false;
  notFound = false;
  requesterEmail = '';

  messages: Message[] = [];
  userInput = '';
  isLoading = false;
  isStuck = false;
  isSendingEmail = false;

  private activeCall: Subscription | null = null;
  private pendingMessages: string[] = [];
  private scrollPending = false;

  private readonly apiBase = 'https://industrial-ml-api.azurewebsites.net';
  private readonly AI_TIMEOUT_MS = 10000;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.notFound = true; return; }

    const forms: StoredForm[] = JSON.parse(localStorage.getItem('cdc_forms') || '[]');
    const stored = forms.find(f => f.id === id);
    if (!stored) { this.notFound = true; return; }

    this.form = stored.form;
    this.requesterEmail = stored.requesterEmail ?? '';
    this.form.questions.forEach(q => {
      this.formData[q.id] = q.type === 'checkbox' ? [] : '';
    });

    this.startConversation();
  }

  ngOnDestroy() {
    this.activeCall?.unsubscribe();
  }

  ngAfterViewChecked() {
    if (this.scrollPending) {
      this.scrollToBottom();
      this.scrollPending = false;
    }
  }

  private scrollToBottom() {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (e) {}
  }

  get systemPrompt(): string {
    if (!this.form) return '';
    const questionList = this.form.questions.map((q, i) => {
      let desc = `${i + 1}. ID="${q.id}" | ${q.label} [type: ${q.type}${q.required ? ', required' : ''}]`;
      if (q.options?.length) desc += ` | Options: ${q.options.join(', ')}`;
      return desc;
    }).join('\n');

    return `You are a friendly AI assistant helping a customer complete a data collection form titled "${this.form.title}". ${this.form.description}

QUESTIONS TO COLLECT:
${questionList}

RULES:
1. Ask one question at a time in a warm, conversational tone. Phrase questions naturally — do not just repeat the label verbatim.
2. For select/radio questions, present the available options clearly so the customer can choose.
3. For checkbox questions (multi-select), present all options and allow multiple selections.
4. If the customer's answer is vague, incomplete, or unclear, ask a specific follow-up to clarify BEFORE tagging.
5. When you have a clear, specific answer, output a tag in EXACTLY this format on its own line:
   ##ANSWER:questionId=value##
   For checkbox (multi-select), join selected options with " | " e.g. ##ANSWER:q4=Option A | Option B##
6. After tagging an answer, briefly confirm what you captured, then move to the next unanswered question.
7. Never re-ask a question that has already been tagged.
8. Once all required questions are answered, congratulate the customer and let them know they can click Submit.
9. Be concise — 2–3 sentences per response maximum.`;
  }

  startConversation() {
    this.messages.push({ role: 'user', text: 'Hello, I\'m here to complete the form.' });
    this.callAI();
  }

  sendMessage() {
    if (!this.userInput.trim()) return;
    const text = this.userInput.trim();
    this.userInput = '';

    // If AI is busy, queue the message — don't drop it
    if (this.isLoading) {
      this.pendingMessages.push(text);
      this.messages.push({ role: 'user', text });
      this.scrollPending = true;
      return;
    }

    this.messages.push({ role: 'user', text });
    this.scrollPending = true;
    this.callAI();
  }

  callAI() {
    // Cancel any stuck previous call
    this.activeCall?.unsubscribe();
    this.isLoading = true;
    this.isStuck = false;

    this.activeCall = this.gemini
      .sendMessageWithSystemPrompt(this.messages, this.systemPrompt)
      .pipe(timeout(this.AI_TIMEOUT_MS))
      .subscribe({
        next: (response: any) => {
          const raw = response.choices[0].message.content;
          this.parseAnswers(raw);
          const display = raw.replace(/##ANSWER:[^#]+##/g, '').trim();
          this.messages.push({ role: 'model', text: display });
          this.scrollPending = true;
          this.isLoading = false;
          this.activeCall = null;

          // Process any queued messages
          if (this.pendingMessages.length > 0) {
            this.pendingMessages = [];
            this.callAI();
          }
        },
        error: (err: any) => {
          this.isLoading = false;
          this.activeCall = null;
          this.pendingMessages = [];

          if (err?.name === 'TimeoutError') {
            this.isStuck = true;
          } else {
            this.messages.push({ role: 'model', text: 'Sorry, I encountered an error. Please try again.' });
            this.scrollPending = true;
          }
        }
      });
  }

  retryLastMessage() {
    this.isStuck = false;
    this.callAI();
  }

  parseAnswers(text: string) {
    const regex = /##ANSWER:([^=\s]+)\s*=\s*([^#\n]+)##/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const id = match[1].trim();
      const value = match[2].trim();
      const question = this.form?.questions.find(q => q.id === id);
      if (question) {
        if (question.type === 'checkbox') {
          this.formData[id] = value.split('|').map((s: string) => s.trim()).filter((s: string) => s);
        } else {
          this.formData[id] = value;
        }
      }
    }
  }

  isAnswered(q: FormQuestion): boolean {
    const v = this.formData[q.id];
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && v !== '';
  }

  get answeredCount(): number {
    return this.form?.questions.filter(q => this.isAnswered(q)).length ?? 0;
  }

  get totalQuestions(): number {
    return this.form?.questions.length ?? 0;
  }

  get progressPercent(): number {
    if (!this.totalQuestions) return 0;
    return Math.round((this.answeredCount / this.totalQuestions) * 100);
  }

  get allRequiredAnswered(): boolean {
    if (!this.form) return false;
    return this.form.questions
      .filter(q => q.required)
      .every(q => this.isAnswered(q));
  }

  submitForm() {
    if (!this.allRequiredAnswered || !this.form || this.isSendingEmail) return;
    this.isSendingEmail = true;

    const responses = this.form.questions.map(q => {
      const v = this.formData[q.id];
      return {
        question: q.label,
        answer: Array.isArray(v) ? v.join(', ') : String(v ?? '')
      };
    });

    if (this.requesterEmail) {
      this.http.post(`${this.apiBase}/api/email/send-responses`, {
        to: this.requesterEmail,
        formTitle: this.form.title,
        responses
      }).subscribe({
        next: () => { this.submitted = true; this.isSendingEmail = false; },
        error: () => { this.submitted = true; this.isSendingEmail = false; }
      });
    } else {
      this.submitted = true;
      this.isSendingEmail = false;
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
