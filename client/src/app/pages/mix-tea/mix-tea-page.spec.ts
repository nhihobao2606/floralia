import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { MixTeaPage } from './mix-tea-page';

describe('MixTeaPage', () => {
  let fixture: ComponentFixture<MixTeaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MixTeaPage],
      imports: [FormsModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(MixTeaPage);
    fixture.detectChanges();
  });

  it('creates the tea mixer and shows its tea choices', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.teas.length).toBeGreaterThan(0);
  });

  it('starts with an empty jar and updates its fill when tea is selected', () => {
    const page = fixture.componentInstance;
    expect(page.jarFillPercent).toBe(8);

    page.selectedSkus = [page.teas[0].sku];

    expect(page.selectedTeas).toHaveLength(1);
    expect(page.jarFillPercent).toBe(48);
  });
});
