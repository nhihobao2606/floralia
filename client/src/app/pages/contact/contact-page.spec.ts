import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ContactPage } from './contact-page';

describe('ContactPage', () => {
  let fixture: ComponentFixture<ContactPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ContactPage],
      imports: [FormsModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPage);
    fixture.detectChanges();
  });

  it('creates the contact page with its message form', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
  });
});
