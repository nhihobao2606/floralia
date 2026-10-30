import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Addresses } from '../addresses/addresses';

describe('Addresses', () => {
  let component: Addresses;
  let fixture: ComponentFixture<Addresses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Addresses],
    }).compileComponents();

    fixture = TestBed.createComponent(Addresses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
