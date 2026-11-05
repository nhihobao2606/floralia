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
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a 404 message and links back to the storefront', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll('a'));

    expect(element.querySelector('h1')?.textContent).toContain('trang này');
    expect(element.textContent).toContain('404');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/products']);
  });
});
