import { AfterViewInit, Component, ElementRef, OnDestroy } from '@angular/core';

interface BrandPhilosophy {
  num: string;
  title: string;
  desc: string;
  image: string;
  imageAlt: string;
}

interface TeamMember {
  name: string;
  role: string;
  img: string;
  facebook?: string;
  instagram?: string;
}

@Component({
  selector: 'app-about',
  standalone: false,
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About implements AfterViewInit, OnDestroy {
  private gardenObserver?: IntersectionObserver;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const garden = this.host.nativeElement.querySelector<HTMLElement>('.garden-stage');
    if (!garden) return;

    if (typeof IntersectionObserver === 'undefined') {
      garden.classList.add('is-grown');
      return;
    }

    this.gardenObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        garden.classList.add('is-grown');
        this.gardenObserver?.unobserve(garden);
      }
    }, { threshold: 0.18 });

    this.gardenObserver.observe(garden);
  }

  ngOnDestroy(): void {
    this.gardenObserver?.disconnect();
  }

  // Triết lý Floralia - 6 giá trị cốt lõi biên tập
  philosophies: BrandPhilosophy[] = [
    {
      num: '01',
      title: 'Nguyên liệu thuần khiết',
      desc: 'Trân trọng hương sắc nguyên bản của hoa và thảo mộc, chọn những nguyên liệu gần gũi với tinh thần thưởng trà Floralia.',
      image: '/assets/images/cuctrang.png',
      imageAlt: 'Những bông cúc trắng dùng làm trà',
    },
    {
      num: '02',
      title: 'Nghệ thuật hòa vị',
      desc: 'Mỗi dòng trà là sự kết hợp hài hòa giữa hương hoa thanh tao và vị trà mộc mạc, tạo nên dấu ấn riêng trong từng tách.',
      image: '/assets/images/hongdalat.png',
      imageAlt: 'Nụ hoa hồng dùng pha trà',
    },
    {
      num: '03',
      title: 'Nuôi dưỡng thân & tâm',
      desc: 'Một khoảng lặng dịu dàng giữa nhịp sống hiện đại, để thân tâm được chậm lại cùng hương trà và hoa cỏ.',
      image: '/assets/images/daubiec.png',
      imageAlt: 'Hoa đậu biếc khô',
    },
    {
      num: '04',
      title: 'Chăm chút từng chi tiết',
      desc: 'Từ cách phối trà đến bao bì và hộp quà, mỗi chi tiết đều được chăm chút với sự giản dị và tinh tế.',
      image: '/assets/images/settrabachlien.png',
      imageAlt: 'Hộp trà Floralia trang nhã',
    },
    {
      num: '05',
      title: 'Trao tặng những điều ý nghĩa',
      desc: 'Mỗi hộp trà Floralia là một món quà tinh tế, thay lời chúc dịu dàng gửi đến bản thân và những người thân yêu.',
      image: '/assets/images/settrahoahong.png',
      imageAlt: 'Hộp quà trà Floralia',
    },
    {
      num: '06',
      title: 'Đồng hành cùng lối sống xanh',
      desc: 'Floralia trân quý thiên nhiên và mong muốn cùng cộng đồng lan tỏa tinh thần sống chậm, tiêu dùng có trách nhiệm.',
      image: '/assets/images/gaoluttraxanh.png',
      imageAlt: 'Trà gạo lứt và trà xanh',
    },
  ];

  // Đội ngũ sáng lập Floralia Tea
  team: TeamMember[] = [
    {
      name: 'Võ Hoàng Phương Vy',
      role: 'Founder & CEO',
      img: '/assets/images/vy.png',
      facebook: 'https://www.facebook.com/phuongvyne1204',
      instagram: 'https://www.instagram.com/phg_wvi/',
    },
    {
      name: 'Hồ Bảo Nhi',
      role: 'Co-Founder & Head of R&D',
      img: '/assets/images/nhi.png',
      facebook: 'https://www.facebook.com/ho.bao.nhi.691652',
      instagram: 'https://www.instagram.com/hobao_nhi.06/',
    },
    {
      name: 'Nguyễn Lý Mỹ Trâm',
      role: 'Co-Founder & Brand Manager',
      img: '/assets/images/tram.png',
      facebook: 'https://www.facebook.com/nguyen.ly.my.tram',
      instagram: 'https://www.instagram.com/mii_charmie',
    },
    {
      name: 'Trương Hoài Thương',
      role: 'Marketing Executive',
      img: '/assets/images/thuong.png',
      facebook: 'https://www.facebook.com/ne.thuong.90038/',
      instagram: 'https://www.instagram.com/iam_thuongg/',
    },
    {
      name: 'Trần Cảnh Nhất Huy',
      role: 'Customer Experience Executive',
      img: '/assets/images/nhathuy.jpg',
      facebook: 'https://www.facebook.com/nhuy010806?locale=vi_VN',
      instagram: 'https://www.instagram.com/nhathuy8676/',
    },
  ];

}
