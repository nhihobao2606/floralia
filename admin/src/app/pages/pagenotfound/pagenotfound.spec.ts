import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Pagenotfound } from './pagenotfound';

describe('Pagenotfound', () => {
  let component: Pagenotfound;
  let fixture: ComponentFixture<Pagenotfound>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Pagenotfound],
      imports: [RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Pagenotfound);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the 404 message and navigation links', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không tìm thấy trang');
    expect(fixture.nativeElement.querySelector('a.back-admin-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a.login-link')).toBeTruthy();
  });
});
