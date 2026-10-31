import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-contact-page',
  standalone: false,
  templateUrl: './contact-page.html',
  styleUrl: './contact-page.css',
})
export class ContactPage {
  submitted = false;

  sendMessage(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const { name, email, phone, message } = form.value;
    const subject = `Liên hệ Floralia Tea từ ${name}`;
    const body = [
      `Họ tên: ${name}`,
      `Email: ${email}`,
      `Số điện thoại: ${phone || 'Chưa cung cấp'}`,
      '',
      'Nội dung:',
      message,
    ].join('\n');

    this.submitted = true;
    window.location.href = `mailto:floralia@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}
