import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FormDefinition, FormQuestion, StoredForm } from '../client-data-collector/client-data-collector';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-form.html',
  styleUrl: './client-form.scss'
})
export class ClientFormComponent implements OnInit {
  private route = inject(ActivatedRoute);

  form: FormDefinition | null = null;
  formData: Record<string, any> = {};
  submitted = false;
  notFound = false;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.notFound = true; return; }

    const forms: StoredForm[] = JSON.parse(localStorage.getItem('cdc_forms') || '[]');
    const stored = forms.find(f => f.id === id);
    if (!stored) { this.notFound = true; return; }

    this.form = stored.form;
    this.form.questions.forEach(q => {
      this.formData[q.id] = q.type === 'checkbox' ? [] : '';
    });
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

  isCheckboxChecked(questionId: string, option: string): boolean {
    const v = this.formData[questionId];
    return Array.isArray(v) && v.includes(option);
  }

  toggleCheckbox(questionId: string, option: string) {
    const v: string[] = this.formData[questionId] || [];
    const idx = v.indexOf(option);
    if (idx === -1) {
      this.formData[questionId] = [...v, option];
    } else {
      this.formData[questionId] = v.filter((o: string) => o !== option);
    }
  }

  submitForm() {
    if (!this.allRequiredAnswered || !this.form) return;
    this.submitted = true;
  }

  downloadCsv() {
    if (!this.form) return;

    const rows = [
      ['Question', 'Answer'],
      ...this.form.questions.map(q => {
        const v = this.formData[q.id];
        const answer = Array.isArray(v) ? v.join('; ') : String(v ?? '');
        return [q.label, answer];
      })
    ];

    const csv = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.form.title.replace(/\s+/g, '_')}_response.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
