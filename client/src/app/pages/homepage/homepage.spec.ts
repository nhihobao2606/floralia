import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Homepage } from './homepage';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, Subject } from 'rxjs';
import { ProductService } from '../../services/product-service';
import { ReviewService } from '../../services/review-service';

describe('Homepage', () => {
  let component: Homepage;
  let fixture: ComponentFixture<Homepage>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CommonModule, HttpClientTestingModule, RouterModule.forRoot([])],
      declarations: [Homepage],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ProductService, useValue: { getAll: () => of([]) } },
        { provide: ReviewService, useValue: { ratingUpdates: new Subject() } },
      ],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Homepage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
