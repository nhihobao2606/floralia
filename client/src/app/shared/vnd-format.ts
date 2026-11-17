import { Pipe, PipeTransform } from '@angular/core';

const vietnameseDongFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

export function formatVietnameseDong(value: number | string | null | undefined): string {
  const amount = Number(value);
  return `${vietnameseDongFormatter.format(Number.isFinite(amount) ? amount : 0)} đ̲`;
}

@Pipe({ name: 'vnd', standalone: false })
export class VietnameseDongPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    return formatVietnameseDong(value);
  }
}
