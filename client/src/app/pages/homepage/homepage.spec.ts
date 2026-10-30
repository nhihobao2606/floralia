import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Homepage } from './homepage';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject } from 'rxjs';
import { ProductService } from '../../services/product-service';
import { ReviewService } from '../../services/review-service';

describe('Homepage', () => {
  let component: Homepage;
  let fixture: ComponentFixture<Homepage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterTestingModule],
      declarations: [Homepage],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ProductService, useValue: { getAll: () => of([]) } },
        { provide: ReviewService, useValue: { ratingUpdates: new Subject() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Homepage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
