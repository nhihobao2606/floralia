import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { BlogDetailComponent } from './blog-detail';

describe('BlogDetailComponent', () => {
  let component: BlogDetailComponent;
  let fixture: ComponentFixture<BlogDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BlogDetailComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterModule.forRoot([])],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'pha-tra-thao-moc-chuan-floralia' }),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
