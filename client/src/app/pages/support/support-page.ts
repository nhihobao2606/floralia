import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type SupportPageKey = 'returns' | 'privacy' | 'terms' | 'faq';

interface SupportSection {
  title: string;
  text: string;
  points?: string[];
}

interface SupportQuestion {
  question: string;
  answer: string;
}

interface SupportContent {
  key: SupportPageKey;
  path: string;
  label: string;
  title: string;
  intro: string;
  sections?: SupportSection[];
  questions?: SupportQuestion[];
}

const supportContent: Record<SupportPageKey, SupportContent> = {
  returns: {
    key: 'returns',
    path: '/return-policy',
    label: 'Chính sách đổi trả',
    title: 'Đổi trả & hỗ trợ đơn hàng',
    intro: 'Floralia mong mỗi đơn trà đến tay bạn trong tình trạng chỉn chu. Nếu sản phẩm nhận được bị hư hỏng hoặc không đúng với đơn đã đặt, hãy liên hệ để đội ngũ kiểm tra và hướng dẫn bước tiếp theo.',
    sections: [
      {
        title: 'Khi cần hỗ trợ đổi trả',
        text: 'Vui lòng giữ lại sản phẩm và bao bì để việc kiểm tra được thuận tiện. Bạn có thể gửi thông tin đơn hàng cùng hình ảnh tình trạng sản phẩm qua email hoặc điện thoại của Floralia.',
        points: ['Mã đơn hàng hoặc thông tin người đặt.', 'Ảnh sản phẩm và bao bì bên ngoài nếu có hư hỏng.', 'Mô tả ngắn về vấn đề bạn gặp phải.'],
      },
      {
        title: 'Quy trình tiếp nhận',
        text: 'Floralia sẽ xem thông tin bạn gửi và phản hồi hướng xử lý phù hợp với tình trạng sản phẩm và đơn hàng. Vui lòng chờ hướng dẫn trước khi gửi sản phẩm về để tránh thất lạc hoặc phát sinh không cần thiết.',
      },
      {
        title: 'Trường hợp khác',
        text: 'Nếu bạn muốn đổi sản phẩm vì lý do khác hoặc cần hỏi về tình trạng đơn, hãy liên hệ trước với đội ngũ để được tư vấn theo từng trường hợp cụ thể.',
      },
    ],
  },
  privacy: {
    key: 'privacy',
    path: '/privacy',
    label: 'Chính sách bảo mật',
    title: 'Quyền riêng tư của bạn',
    intro: 'Chúng tôi tôn trọng thông tin bạn cung cấp khi mua sắm và trao đổi với Floralia. Trang này tóm tắt cách thông tin được sử dụng trong phạm vi phục vụ đơn hàng và hỗ trợ khách hàng.',
    sections: [
      {
        title: 'Thông tin bạn cung cấp',
        text: 'Khi đặt hàng hoặc liên hệ, bạn có thể cung cấp thông tin liên lạc, địa chỉ nhận hàng, nội dung trao đổi và thông tin cần thiết để nhận diện đơn hàng.',
      },
      {
        title: 'Mục đích sử dụng',
        text: 'Thông tin được dùng để xác nhận và hỗ trợ đơn hàng, liên hệ với bạn về yêu cầu đã gửi, và giải quyết các vấn đề phát sinh liên quan đến dịch vụ.',
      },
      {
        title: 'Giữ an toàn thông tin',
        text: 'Vui lòng không gửi mật khẩu hoặc đầy đủ thông tin thẻ thanh toán qua email hay tin nhắn. Nếu cần hỏi về dữ liệu cá nhân của mình, bạn có thể liên hệ Floralia qua địa chỉ email hoặc số điện thoại ở cuối trang.',
      },
    ],
  },
  terms: {
    key: 'terms',
    path: '/terms',
    label: 'Điều khoản dịch vụ',
    title: 'Điều khoản sử dụng dịch vụ',
    intro: 'Khi sử dụng website Floralia, vui lòng đọc thông tin sản phẩm và các hướng dẫn hiển thị trước khi gửi yêu cầu đặt hàng hoặc liên hệ.',
    sections: [
      {
        title: 'Thông tin sản phẩm',
        text: 'Floralia cố gắng trình bày thông tin sản phẩm rõ ràng. Màu sắc hiển thị có thể khác đôi chút tùy thiết bị; nếu cần xác nhận thành phần, quy cách hoặc lựa chọn sản phẩm, vui lòng hỏi đội ngũ trước khi đặt.',
      },
      {
        title: 'Đơn hàng và trao đổi',
        text: 'Vui lòng cung cấp thông tin liên hệ và nhận hàng chính xác. Nếu cần điều chỉnh hoặc hủy yêu cầu đã gửi, hãy liên hệ Floralia sớm để được kiểm tra trạng thái đơn.',
      },
      {
        title: 'Sử dụng website',
        text: 'Vui lòng sử dụng website và các biểu mẫu liên hệ đúng mục đích, không gửi nội dung gây ảnh hưởng đến hoạt động của dịch vụ hoặc quyền lợi của người khác.',
      },
      {
        title: 'Cập nhật thông tin',
        text: 'Thông tin sản phẩm và nội dung hỗ trợ có thể được điều chỉnh khi website được cập nhật. Nếu có điểm nào chưa rõ, hãy liên hệ Floralia để được xác nhận trước khi tiếp tục.',
      },
    ],
  },
  faq: {
    key: 'faq',
    path: '/faq',
    label: 'Câu hỏi thường gặp',
    title: 'Floralia giải đáp cùng bạn',
    intro: 'Một vài câu trả lời nhanh về sản phẩm trà và việc đặt hàng. Nếu chưa tìm thấy điều mình cần, đội ngũ Floralia luôn sẵn lòng hỗ trợ.',
    questions: [
      {
        question: 'Làm sao để chọn loại trà phù hợp?',
        answer: 'Bạn có thể xem mô tả và thành phần trên trang sản phẩm. Nếu cần tư vấn thêm về hương vị hoặc cách pha, hãy liên hệ Floralia và cho chúng tôi biết sở thích của bạn.',
      },
      {
        question: 'Tôi cần làm gì nếu đơn hàng bị thiếu hoặc sản phẩm hư hỏng?',
        answer: 'Vui lòng giữ lại sản phẩm và bao bì, sau đó gửi mã đơn cùng hình ảnh tình trạng bạn nhận được qua email hoặc điện thoại để Floralia kiểm tra và hướng dẫn.',
      },
      {
        question: 'Tôi có thể thay đổi thông tin đơn hàng không?',
        answer: 'Hãy liên hệ Floralia sớm nhất có thể và cung cấp mã đơn. Đội ngũ sẽ kiểm tra trạng thái đơn để tư vấn khả năng cập nhật thông tin.',
      },
      {
        question: 'Tôi xem thông tin bảo quản trà ở đâu?',
        answer: 'Hãy tham khảo hướng dẫn trên bao bì sản phẩm. Nếu cần làm rõ cách bảo quản một dòng trà cụ thể, bạn có thể gửi tên sản phẩm để Floralia hỗ trợ.',
      },
      {
        question: 'Liên hệ Floralia bằng cách nào?',
        answer: 'Bạn có thể gửi email đến floralia@gmail.com hoặc gọi 0901 234 567. Vui lòng cung cấp mã đơn nếu câu hỏi liên quan đến đơn hàng.',
      },
    ],
  },
};

@Component({
  selector: 'app-support-page',
  standalone: false,
  templateUrl: './support-page.html',
  styleUrl: './support-page.css',
})
export class SupportPage {
  readonly pages = Object.values(supportContent);
  readonly page: SupportContent;

  constructor(route: ActivatedRoute) {
    const key = route.snapshot.data['supportPage'] as SupportPageKey;
    this.page = supportContent[key] ?? supportContent.faq;
  }
}
