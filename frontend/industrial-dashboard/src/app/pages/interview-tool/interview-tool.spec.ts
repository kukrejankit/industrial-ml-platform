import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewToolComponent } from './interview-tool';

describe('InterviewTool', () => {
  let component: InterviewToolComponent;
  let fixture: ComponentFixture<InterviewToolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewToolComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewToolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
