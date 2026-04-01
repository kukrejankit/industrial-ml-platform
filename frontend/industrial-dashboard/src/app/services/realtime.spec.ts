import { TestBed } from '@angular/core/testing';

import { Realtime } from './realtime';

describe('Realtime', () => {
  let service: Realtime;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Realtime);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
