import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService, Message } from '../../services/gemini.service';

export type QuestionType = 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'radio' | 'checkbox';

export interface FormQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormDefinition {
  title: string;
  description: string;
  questions: FormQuestion[];
}

export interface StoredForm {
  id: string;
  createdAt: string;
  form: FormDefinition;
}

export enum CollectorPhase {
  SetupChat = 1,
  FormPreview = 2,
  Send = 3,
  Sent = 4
}

interface ProgressField {
  key: string;
  label: string;
  description: string;
  value: string | null;
}

@Component({
  selector: 'app-client-data-collector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-data-collector.html',
  styleUrl: './client-data-collector.scss'
})
export class ClientDataCollectorComponent implements OnInit, AfterViewChecked {
  private gemini = inject(GeminiService);

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  CollectorPhase = CollectorPhase;
  phase: CollectorPhase = CollectorPhase.SetupChat;

  // Phase 1 state
  messages: Message[] = [];
  userInput = '';
  isLoading = false;
  isGeneratingForm = false;
  formParseError = false;
  interviewerName = '';
  started = false;

  progressFields: ProgressField[] = [
    { key: 'PURPOSE',      label: 'Purpose',       description: 'What the form is for',     value: null },
    { key: 'AUDIENCE',     label: 'Audience',       description: 'Who will fill it out',     value: null },
    { key: 'FIELDS',       label: 'Fields',         description: 'Data points to collect',   value: null },
    { key: 'REQUIREMENTS', label: 'Requirements',   description: 'Mandatory fields / rules', value: null },
  ];

  // Phase 2 state
  generatedForm: FormDefinition | null = null;

  readonly typeLabels: Record<QuestionType, string> = {
    text: 'Short Text', textarea: 'Long Text', email: 'Email', phone: 'Phone',
    number: 'Number', date: 'Date', select: 'Dropdown', radio: 'Multiple Choice', checkbox: 'Checkboxes'
  };

  // Phase 3 state
  customerEmail = '';
  generatedLink = '';
  storedFormId = '';
  linkCopied = false;

  private readonly setupSystemPrompt = `You are a friendly data collection specialist helping a business owner design a customer data collection form. Your job is to gather four pieces of information through natural conversation, one at a time.

INFORMATION TO COLLECT (in this order):
1. PURPOSE — What is the business purpose of collecting this data? What decision or process will it drive?
2. AUDIENCE — Who are the customers or end-users that will fill out this form?
3. FIELDS — What specific pieces of information need to be collected? Ask them to list all the data points they need.
4. REQUIREMENTS — Are there any minimum requirements or constraints? (e.g., "email is mandatory", "must collect phone number")

RULES:
1. Ask one question at a time in a conversational, friendly tone.
2. When the user answers a question, extract the key information and output a tag in EXACTLY this format:
   ##CAPTURED:PURPOSE=<value>##
   ##CAPTURED:AUDIENCE=<value>##
   ##CAPTURED:FIELDS=<value>##
   ##CAPTURED:REQUIREMENTS=<value>##
   Use the exact field key. Keep the captured value concise (1–2 sentences max).
3. After capturing a field, confirm briefly what you understood, then ask the next uncaptured question.
4. Never ask about a field already captured.
5. Once PURPOSE and FIELDS are captured, let the user know they can click "Generate Form" when ready.
6. Be concise — 2–4 sentences per response maximum.`;

  get capturedCount() {
    return this.progressFields.filter(f => f.value !== null).length;
  }

  get canGenerateForm() {
    const purpose = this.progressFields.find(f => f.key === 'PURPOSE')?.value;
    const fields  = this.progressFields.find(f => f.key === 'FIELDS')?.value;
    return !!purpose && !!fields && !this.isLoading && !this.isGeneratingForm;
  }

  ngOnInit() {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (e) {}
  }

  startSetup() {
    if (!this.interviewerName.trim()) return;
    this.started = true;
    const intro = `Hi, I'm ${this.interviewerName}. I need help designing a data collection form for my customers.`;
    this.messages.push({ role: 'user', text: intro });
    this.callSetupAI();
  }

  sendMessage() {
    if (!this.userInput.trim() || this.isLoading) return;
    const text = this.userInput.trim();
    this.userInput = '';
    this.messages.push({ role: 'user', text });
    this.callSetupAI();
  }

  callSetupAI() {
    this.isLoading = true;
    this.gemini.sendMessageWithSystemPrompt(this.messages, this.setupSystemPrompt).subscribe({
      next: (response: any) => {
        const raw = response.choices[0].message.content;
        this.parseCapturedFields(raw);
        const display = raw.replace(/##CAPTURED:[^#]+##/g, '').trim();
        this.messages.push({ role: 'model', text: display });
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.messages.push({ role: 'model', text: 'Sorry, I encountered an error. Please try again.' });
      }
    });
  }

  parseCapturedFields(text: string) {
    const regex = /##CAPTURED:([A-Z_]+)=([^#]+)##/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      const field = this.progressFields.find(f => f.key === key);
      if (field) field.value = value;
    }
  }

  generateForm() {
    this.isGeneratingForm = true;
    this.formParseError = false;

    const captured = this.progressFields
      .filter(f => f.value !== null)
      .map(f => `- ${f.label}: ${f.value}`)
      .join('\n');

    const conversationContext = this.messages.slice(-6)
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`)
      .join('\n\n');

    const generationPrompt = `Based on the following data collection requirements, generate a precise JSON form definition.

REQUIREMENTS GATHERED:
${captured}

CONVERSATION CONTEXT:
${conversationContext}

OUTPUT RULES:
1. Output ONLY a valid JSON object. No markdown, no explanation, no code fences.
2. Generate between 4 and 12 questions.
3. Use "email" for email, "phone" for phone, "date" for dates, "number" for quantities, "select" or "radio" for categorical choices (≤6 options), "textarea" for open-ended, "text" for short answers.
4. Mark fields as required:true when mentioned as mandatory or clearly essential.
5. Include "options" array ONLY for select, radio, or checkbox types.

REQUIRED JSON SCHEMA:
{
  "title": "descriptive form title",
  "description": "1-sentence description shown to the respondent",
  "questions": [
    {
      "id": "q1",
      "label": "question text",
      "type": "text|textarea|email|phone|number|date|select|radio|checkbox",
      "required": true,
      "placeholder": "hint text (omit for select/radio/checkbox)"
    }
  ]
}`;

    const genMessages: Message[] = [{ role: 'user', text: generationPrompt }];
    const genSystemPrompt = 'You are a JSON form schema generator. Output only valid JSON, nothing else.';

    this.gemini.sendMessageWithSystemPrompt(genMessages, genSystemPrompt).subscribe({
      next: (response: any) => {
        const raw = response.choices[0].message.content;
        const parsed = this.parseFormJson(raw);
        if (parsed) {
          this.generatedForm = parsed;
          this.phase = CollectorPhase.FormPreview;
        } else {
          this.formParseError = true;
        }
        this.isGeneratingForm = false;
      },
      error: () => {
        this.isGeneratingForm = false;
        this.formParseError = true;
      }
    });
  }

  parseFormJson(raw: string): FormDefinition | null {
    try {
      const stripped = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]) as FormDefinition;
    } catch {
      return null;
    }
  }

  approveForm() {
    this.phase = CollectorPhase.Send;
  }

  rejectForm() {
    this.phase = CollectorPhase.SetupChat;
    this.generatedForm = null;
    this.messages.push({ role: 'model', text: "No problem! Let's refine the requirements. What would you like to change or add?" });
  }

  sendToCustomer() {
    if (!this.customerEmail.trim() || !this.generatedForm) return;
    const id = crypto.randomUUID();
    const stored: StoredForm = {
      id,
      createdAt: new Date().toISOString(),
      form: this.generatedForm
    };
    const forms: StoredForm[] = JSON.parse(localStorage.getItem('cdc_forms') || '[]');
    forms.push(stored);
    localStorage.setItem('cdc_forms', JSON.stringify(forms));
    this.storedFormId = id;
    this.generatedLink = `${window.location.origin}/form/${id}`;
    this.phase = CollectorPhase.Sent;
  }

  copyLink() {
    navigator.clipboard.writeText(this.generatedLink).then(() => {
      this.linkCopied = true;
      setTimeout(() => this.linkCopied = false, 2000);
    });
  }

  get mailtoHref(): string {
    const subject = encodeURIComponent(`Please fill out: ${this.generatedForm?.title ?? 'our form'}`);
    const body = encodeURIComponent(
      `Hi,\n\nPlease take a moment to fill out this form:\n${this.generatedLink}\n\nThank you.`
    );
    return `mailto:${this.customerEmail}?subject=${subject}&body=${body}`;
  }

  newCollection() {
    this.phase = CollectorPhase.SetupChat;
    this.messages = [];
    this.userInput = '';
    this.isLoading = false;
    this.isGeneratingForm = false;
    this.formParseError = false;
    this.interviewerName = '';
    this.started = false;
    this.progressFields.forEach(f => f.value = null);
    this.generatedForm = null;
    this.customerEmail = '';
    this.generatedLink = '';
    this.storedFormId = '';
    this.linkCopied = false;
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
