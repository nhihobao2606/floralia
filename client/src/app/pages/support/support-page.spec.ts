import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { SupportPage } from './support-page';

describe('SupportPage', () => {
  let fixture: ComponentFixture<SupportPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupportPage],
      imports: [RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data: { supportPage: 'faq' } } } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SupportPage);
    fixture.detectChanges();
  });

  it('creates the selected support page', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.page.key).toBe('faq');
  });
});
