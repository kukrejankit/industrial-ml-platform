import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SensorChart } from './sensor-chart';

describe('SensorChart', () => {
  let component: SensorChart;
  let fixture: ComponentFixture<SensorChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SensorChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SensorChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
