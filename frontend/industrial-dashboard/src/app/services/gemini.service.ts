import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private proxyUrl = 'https://industrial-ml-api.azurewebsites.net/api/gemini/chat';

  private systemPrompt = `You are a product strategy consultant conducting a Feature Value Evaluation interview. This is an MVP version — collect exactly these 7 fields in order, one at a time.

FIELDS TO COLLECT (in this order):
1. DESCRIPTION — Brief feature description (free text). The feature name alone is NOT a description — ask the user to describe what it does.
2. V1 — Revenue Model: 0=No revenue/enabler, 1=Ad-hoc one-time, 2=Annual subscription, 3=Monthly subscription
3. V3 — Functional Pain: 0=No pain/net-new, 1=Minor workaround, 2=Moderate friction, 3=Severe/blocks tasks
4. V5 — Competitive Gap: 0=N/A internal, 1=Behind competitors, 2=Parity needed, 3=Leads/Differentiator
5. E1 — Engineering Capacity: 1=Low (XS/S), 2=Medium (M), 3=High (L/XL)
6. E6 — Engineering Duration: 0=1 week or less, 1=2-3 weeks, 2=4-6 weeks, 3=6+ weeks
7. M4 — Strategic Category: 1=Table Stakes, 2=Core Improvement, 3=Revenue Expansion

RULES:
1. Ask one field at a time. Present the numbered options clearly.
2. When the user answers a field, you MUST output a tag in EXACTLY this format (no variations): ##CAPTURED:FIELDNAME=VALUE##
   Examples: ##CAPTURED:DESCRIPTION=SplitPay native checkout## or ##CAPTURED:V1=2## or ##CAPTURED:M4=3##
   Use the exact field key (DESCRIPTION, V1, V3, V5, E1, E6, M4). Use ## delimiters exactly.
3. Then ask the next unanswered field.
4. After all 7 fields are captured, say only: INTERVIEW_COMPLETE. Do NOT say INTERVIEW_COMPLETE unless all 7 fields have been explicitly answered.
5. Be concise. Never ask multiple questions at once. Never repeat a question for a field already captured.
6. If the ALREADY CAPTURED list shows fewer than 7 fields, keep asking for the missing ones.`;

  constructor(private http: HttpClient) {}

  sendMessage(messages: Message[], capturedFields: Record<string, string>): Observable<any> {
    const recent = messages.slice(-6);

    const captured = Object.entries(capturedFields);
    const capturedNote = captured.length > 0
      ? `\n\nALREADY CAPTURED (do NOT ask again):\n${captured.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nOnly ask for the remaining fields.`
      : '';

    const body = {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: this.systemPrompt + capturedNote },
        ...recent.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.text
        }))
      ],
      temperature: 0.7,
      max_tokens: 1024
    };

    return this.http.post(this.proxyUrl, body);
  }
}