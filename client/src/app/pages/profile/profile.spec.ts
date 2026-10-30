import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Profile } from './profile';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, HttpClientTestingModule],
      declarations: [Profile],
      providers: [
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
