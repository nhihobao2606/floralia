require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

if (!process.env.MONGODB_URI) {
  console.error("Thiếu MONGODB_URI trong .env");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

function getBase64Image(fileName) {
  try {
    const fullPath = path.join(__dirname, "../client/src/app/assets/images", fileName);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath).toString("base64");
    }
  } catch (err) {
    console.warn("Không thể đọc ảnh:", fileName, err.message);
  }
  return null;
}

const blogArticles = [
  {
    slug: "pha-tra-thao-moc-chuan-floralia-trai-nghiem-tung-ngum-binh-yen",
    title: "Pha Trà Thảo Mộc Chuẩn Floralia – Trải Nghiệm Từng Ngụm Bình Yên",
    excerpt: "Một tách trà thảo mộc không chỉ dừng lại ở vị ngon, mà còn là một hành trình cảm giác và tinh thần. Tại Floralia – Herbal Tea, chúng tôi tin rằng cách pha trà đúng sẽ kích hoạt trọn vẹn hương thơm và tinh chất thảo mộc, giúp bạn tận hưởng trọn vẹn phút giây thư thái.",
    content: `
      <p class="lead">Một tách trà thảo mộc không chỉ dừng lại ở vị ngon, mà còn là một hành trình cảm giác và tinh thần. Tại Floralia – Herbal Tea, chúng tôi tin rằng cách pha trà đúng sẽ kích hoạt trọn vẹn hương thơm và tinh chất thảo mộc, giúp bạn tận hưởng trọn vẹn phút giây thư thái.</p>
      
      <h3>1. Chuẩn Bị Nguyên Liệu Và Dụng Cụ</h3>
      <ul>
        <li><strong>Lá trà thảo mộc Floralia:</strong> chọn theo sở thích và gu thưởng thức của bạn (hoa cúc, hoa nhài, bạc hà, gừng quế…).</li>
        <li><strong>Nước sạch:</strong> dùng nước lọc hoặc nước suối tinh khiết.</li>
        <li><strong>Ấm trà, tách trà:</strong> ấm sứ hoặc thủy tinh sẽ giữ hương vị tốt nhất.</li>
      </ul>
      <div class="tip-box">
        <strong>Tip:</strong> Tránh dùng nước vừa đun sôi để pha trực tiếp với lá trà nhạy cảm, sẽ làm mất đi hương thơm tự nhiên.
      </div>

      <h3>2. Nhiệt Độ Và Thời Gian Pha</h3>
      <ul>
        <li><strong>Trà hoa cúc, hoa nhài, bạc hà:</strong> rót nước 80–85°C, ngâm 3–5 phút.</li>
        <li><strong>Trà gừng, quế:</strong> rót nước 90–95°C, ngâm 5–7 phút để tinh chất lan tỏa.</li>
        <li><strong>Trà hỗn hợp hoa quả khô:</strong> rót nước 85–90°C, ngâm 5 phút, tùy khẩu vị mà thêm mật ong hoặc chanh.</li>
      </ul>
      <div class="note-box">
        <strong>Lưu ý:</strong> Thời gian và nhiệt độ quyết định cường độ hương vị và màu nước, nên bạn có thể thử điều chỉnh theo gu cá nhân.
      </div>

      <h3>3. Thưởng Thức Từng Ngụm</h3>
      <ol>
        <li>Nhìn lá trà nở ra, hít thật sâu hương thảo mộc.</li>
        <li>Nhấp một ngụm nhỏ, để hương thơm lan tỏa, cảm nhận vị thanh, ấm, hoặc dịu nhẹ tùy loại trà.</li>
        <li>Thưởng thức chậm rãi, kết hợp với nhạc nhẹ hoặc khoảng không gian yên tĩnh, để trà giúp cân bằng tâm trí và tinh thần.</li>
      </ol>
      <p>Một tách trà ngon là một trải nghiệm chậm rãi, nơi bạn có thể tạm gác căng thẳng, lắng nghe bản thân và thư giãn hoàn toàn.</p>

      <h3>4. Bí Quyết Nhỏ Để Trà Thảo Mộc Ngon Hơn</h3>
      <ul>
        <li>Dùng ấm sứ hoặc thủy tinh để giữ nhiệt và màu nước trong veo.</li>
        <li>Ngâm trà theo đúng thời gian khuyến nghị, tránh quá lâu sẽ bị đắng.</li>
        <li>Kết hợp thảo mộc và hoa quả khô để tạo vị ngọt tự nhiên, giàu hương thơm.</li>
        <li>Tận hưởng khoảnh khắc pha trà như một nghi lễ nhỏ, chứ không chỉ là thao tác hàng ngày.</li>
      </ul>
    `,
    author: "Phương Oanh",
    authorRole: "Chuyên gia trà thảo mộc",
    date: "20 Tháng 5, 2024",
    publishedAt: new Date("2024-05-20"),
    category: "Bí quyết pha trà",
    categorySlug: "bi-quyet-pha-tra",
    image: "/assets/images/bl1.jpg",
    imageFileName: "bl1.jpg",
    featured: true,
    views: 1280,
    readTime: "4 phút",
    tags: ["#Floralia", "#TraThaoMoc", "#BiQuyetPhaTra", "#BinhYen"]
  },
  {
    slug: "bua-tra-nhe-buoi-sang-khi-ngay-moi-bat-dau-tu-su-binh-yen",
    title: "Bữa Trà Nhẹ Buổi Sáng – Khi Ngày Mới Bắt Đầu Từ Sự Bình Yên",
    excerpt: "Có người bắt đầu ngày mới bằng một tách cà phê đậm đặc, và cũng có người chọn cho mình một tách trà thảo mộc — dịu dàng, tinh khiết, và đầy năng lượng an lành.",
    content: `
      <p class="lead">Có người bắt đầu ngày mới bằng một tách cà phê đậm đặc, và cũng có người chọn cho mình một tách trà thảo mộc — dịu dàng, tinh khiết, và đầy năng lượng an lành. 🍵</p>
      
      <p>Bữa trà sáng không ồn ào, không vội vã. Đó là khoảng thời gian nhỏ, nơi ta được trở về với chính mình, lắng nghe hơi thở, cảm nhận hương thảo mộc lan tỏa trong không gian.</p>

      <h3>🌿 Một tách trà – một khởi đầu tinh tế</h3>
      <p>Khi ánh nắng đầu ngày vừa khẽ chạm lên khung cửa, một tách trà cúc nhẹ vị, hoặc trà gừng cam thảo ấm nồng sẽ là lời chào buổi sáng dịu dàng nhất.</p>
      <p>Trà không chỉ đánh thức cơ thể, mà còn làm dịu tâm trí – giúp ta khởi động ngày mới với tâm thế nhẹ nhõm và tập trung hơn.</p>
      
      <blockquote class="tea-quote">
        “Buổi sáng là khoảnh khắc của sự tươi mới, và trà là cách để ta giữ lại cảm giác ấy lâu hơn một chút.” 🌸
      </blockquote>

      <h3>🍞 Gợi ý cho bữa trà nhẹ buổi sáng</h3>
      <p>Một bữa trà sáng hoàn hảo không cần cầu kỳ – chỉ cần tinh tế vừa đủ:</p>
      <ul>
        <li>Một tách trà hoa nhài hoặc trà bạc hà – thanh mát, đánh thức vị giác.</li>
        <li>Một lát bánh mì nướng, mật ong hoặc mứt trái cây, đủ để lót dạ mà không nặng nề.</li>
        <li>Một vài trái cây tươi – cam, dâu, hoặc táo, để bổ sung năng lượng tự nhiên.</li>
      </ul>
      <p>Bữa trà ấy không chỉ nuôi dưỡng cơ thể, mà còn nâng niu tâm hồn – một nghi thức nhỏ nhưng khiến cả ngày trở nên khác biệt.</p>

      <h3>💚 Khi trà trở thành thói quen sống</h3>
      <p>Uống trà buổi sáng không chỉ là thói quen, mà là một phong cách sống đầy tinh tế. Người biết thưởng trà buổi sáng là người hiểu giá trị của sự chậm rãi – biết lắng nghe cơ thể, biết trân trọng những điều nhỏ bé.</p>
      <p>Floralia tin rằng, mỗi tách trà thảo mộc là một khoảnh khắc kết nối với bình yên. Dù bạn bắt đầu ngày mới ở một quán nhỏ, góc ban công, hay bên bàn làm việc – chỉ cần một tách trà thơm, là thế giới trở nên dịu lại. 🌞</p>

      <h3>🌿 Floralia – Khơi nguồn năng lượng từ sự an lành</h3>
      <p>Hãy để Floralia cùng bạn tạo nên bữa trà sáng nhẹ nhàng mà trọn vẹn. Bởi mỗi ngày mới là một cơ hội để sống chậm hơn, thở sâu hơn, và bắt đầu mọi điều bằng một tách trà đầy yêu thương. 💚</p>
    `,
    author: "Thương Oanh",
    authorRole: "Biên tập viên Floralia",
    date: "24 Tháng 5, 2024",
    publishedAt: new Date("2024-05-24"),
    category: "Phong cách sống",
    categorySlug: "phong-cach-song",
    image: "/assets/images/bl2.jpg",
    imageFileName: "bl2.jpg",
    featured: false,
    views: 960,
    readTime: "3 phút",
    tags: ["#Floralia", "#TraThaoMoc", "#BuoiSangAnLanh", "#BuaTraSang", "#HerbalTea"]
  },
  {
    slug: "tra-hoa-cuc-nhe-nhang-cho-nhung-ngay-can-nghi-ngoi",
    title: "Trà Hoa Cúc – Nhẹ Nhàng Cho Những Ngày Cần Nghỉ Ngơi",
    excerpt: "Có những ngày tâm trí đầy tiếng ồn, và điều ta cần… chỉ là một tách trà ấm để lòng dịu lại. Trà hoa cúc tại Floralia mang đến cảm giác an yên rất riêng...",
    content: `
      <p class="lead">Có những ngày tâm trí đầy tiếng ồn, và điều ta cần… chỉ là một tách trà ấm để lòng dịu lại. 🌼</p>
      
      <p>Trà hoa cúc tại Floralia được yêu thích bởi hương thơm nhẹ nhàng và cảm giác thư giãn dễ chịu sau mỗi ngụm trà. Không quá đậm vị, không gắt, trà cúc mang đến cảm giác an yên rất riêng – như một khoảng nghỉ nhỏ giữa ngày dài vội vã.</p>

      <h3>💛 Công dụng được nhiều khách hàng yêu thích</h3>
      <ul class="benefit-list">
        <li>✨ Giúp thư giãn tinh thần</li>
        <li>✨ Hỗ trợ ngủ ngon hơn</li>
        <li>✨ Làm dịu cơ thể sau ngày dài mệt mỏi</li>
        <li>✨ Thanh nhẹ, dễ uống mỗi ngày</li>
      </ul>

      <p>Chỉ cần một tách trà nóng, một bản nhạc nhẹ và vài phút cho riêng mình… đôi khi vậy là đủ để chữa lành cả một ngày dài. 🍃</p>

      <blockquote class="tea-quote">
        🌸 Floralia – Herbal Tea<br>
        “Nơi từng hương trà mang theo một chút bình yên.”
      </blockquote>
    `,
    author: "Trương Minh",
    authorRole: "Trà sư & Chăm sóc khách hàng",
    date: "2 Tháng 6, 2024",
    publishedAt: new Date("2024-06-02"),
    category: "Thảo mộc trị liệu",
    categorySlug: "thao-moc-tri-lieu",
    image: "/assets/images/bl3.jpg",
    imageFileName: "bl3.jpg",
    featured: true,
    views: 1450,
    readTime: "3 phút",
    tags: ["#TraHoaCuc", "#NghiNgoi", "#ThuGian", "#NguNgon", "#Floralia"]
  },
  {
    slug: "bao-quan-tra-thao-moc-dung-cach-giu-tron-huong-vi-thien-nhien",
    title: "Bảo Quản Trà Thảo Mộc Đúng Cách – Giữ Trọn Hương Vị Thiên Nhiên",
    excerpt: "Trà thảo mộc là món quà từ thiên nhiên, mang trong mình hương thơm dịu nhẹ và những giá trị tinh thần đặc biệt. Bảo quản đúng cách để giữ trọn vẹn sự tinh khiết trong từng lá trà...",
    content: `
      <p class="lead">Trà thảo mộc là món quà từ thiên nhiên, mang trong mình hương thơm dịu nhẹ và những giá trị tinh thần đặc biệt. Tuy nhiên, để mỗi tách trà luôn giữ được hương vị nguyên bản và chất lượng tốt nhất, việc bảo quản đúng cách là điều vô cùng quan trọng. Tại Floralia – Herbal Tea, chúng tôi mong muốn chia sẻ những bí quyết đơn giản giúp bạn lưu giữ trọn vẹn sự tinh khiết trong từng lá trà.</p>

      <h3>1. Lựa Chọn Nơi Bảo Quản Phù Hợp</h3>
      <p>Trà thảo mộc rất nhạy cảm với môi trường xung quanh. Ánh sáng, nhiệt độ và độ ẩm đều có thể ảnh hưởng đến chất lượng trà.</p>
      <ul>
        <li>Bảo quản trà ở nơi khô ráo, thoáng mát.</li>
        <li>Tránh ánh nắng trực tiếp hoặc những nơi có nhiệt độ cao.</li>
        <li>Không đặt trà gần bếp nấu ăn hoặc các nguồn nhiệt khác.</li>
        <li>Hạn chế để trà trong môi trường có độ ẩm cao vì dễ làm trà mất hương và giảm chất lượng.</li>
      </ul>
      <div class="tip-box">
        <strong>Tip:</strong> Một chiếc tủ kín hoặc ngăn chứa thực phẩm khô là lựa chọn lý tưởng để bảo quản trà thảo mộc.
      </div>

      <h3>2. Sử Dụng Hộp Đựng Kín</h3>
      <p>Sau khi mở bao bì, trà cần được bảo quản trong hộp kín để hạn chế tiếp xúc với không khí.</p>
      <ul>
        <li>Ưu tiên sử dụng hộp thủy tinh có nắp kín hoặc hộp thiếc chuyên dụng.</li>
        <li>Đảm bảo hộp đựng luôn sạch và khô trước khi cho trà vào.</li>
        <li>Đóng kín nắp ngay sau mỗi lần sử dụng.</li>
      </ul>
      <div class="note-box">
        <strong>Lưu ý:</strong> Không nên để trà trong túi đã mở quá lâu vì không khí có thể làm giảm hương thơm tự nhiên của các loại hoa và thảo mộc.
      </div>

      <h3>3. Tránh Các Mùi Hương Mạnh</h3>
      <p>Lá trà có khả năng hấp thụ mùi rất nhanh. Vì vậy, việc đặt trà gần các thực phẩm có mùi mạnh sẽ ảnh hưởng đáng kể đến chất lượng trà.</p>
      <ul>
        <li>Không để trà gần cà phê, gia vị hoặc thực phẩm có mùi nồng.</li>
        <li>Tránh bảo quản chung với các loại hóa mỹ phẩm hoặc chất tẩy rửa.</li>
        <li>Mỗi loại trà nên được bảo quản riêng để giữ được hương vị đặc trưng.</li>
      </ul>

      <h3>4. Sử Dụng Trong Thời Gian Khuyến Nghị</h3>
      <p>Mặc dù trà thảo mộc có thể bảo quản trong thời gian dài, nhưng hương vị sẽ ngon nhất khi được sử dụng trong khoảng thời gian khuyến nghị.</p>
      <ul>
        <li>Kiểm tra ngày sản xuất và hạn sử dụng trên bao bì.</li>
        <li>Sử dụng trà trong vòng vài tháng sau khi mở hộp để đạt chất lượng tốt nhất.</li>
        <li>Tránh tích trữ quá nhiều trà nếu không sử dụng thường xuyên.</li>
      </ul>

      <h3>5. Thưởng Thức Trà Với Sự Trân Trọng</h3>
      <p>Bảo quản trà không chỉ là giữ gìn sản phẩm mà còn là cách trân trọng những giá trị mà thiên nhiên mang lại. Mỗi lần mở hộp trà, hãy dành một chút thời gian để cảm nhận hương thơm dịu nhẹ của hoa cúc, hoa nhài, bạc hà hay gừng quế.</p>

      <h3>6. Những Sai Lầm Cần Tránh Khi Bảo Quản Trà</h3>
      <ul>
        <li>Để trà trong tủ lạnh mà không có hộp kín.</li>
        <li>Mở hộp trà quá thường xuyên nhưng không đóng kín sau khi sử dụng.</li>
        <li>Đặt trà gần cửa sổ hoặc nơi có ánh nắng chiếu trực tiếp.</li>
        <li>Trộn nhiều loại trà khác nhau trong cùng một hộp bảo quản.</li>
      </ul>
    `,
    author: "Louis Mai",
    authorRole: "Chuyên viên chất lượng",
    date: "9 Tháng 6, 2024",
    publishedAt: new Date("2024-06-09"),
    category: "Bí quyết pha trà",
    categorySlug: "bi-quyet-pha-tra",
    image: "/assets/images/bl4.jpg",
    imageFileName: "bl4.jpg",
    featured: true,
    views: 1120,
    readTime: "5 phút",
    tags: ["#BaoQuanTra", "#ThaoMoc", "#BiQuyet", "#Floralia"]
  },
  {
    slug: "tra-hoa-nhai-huong-thom-diu-dang-cho-nhung-khoanh-khac-thanh-thoi",
    title: "Trà Hoa Nhài – Hương Thơm Dịu Dàng Cho Những Khoảnh Khắc Thảnh Thơi",
    excerpt: "Giữa nhịp sống bận rộn, đôi khi điều chúng ta cần không phải là một điều gì quá lớn lao, mà chỉ đơn giản là một khoảng lặng để nghỉ ngơi và tái tạo năng lượng.",
    content: `
      <p class="lead">Giữa nhịp sống bận rộn, đôi khi điều chúng ta cần không phải là một điều gì quá lớn lao, mà chỉ đơn giản là một khoảng lặng để nghỉ ngơi và tái tạo năng lượng. Một tách trà hoa nhài thơm dịu có thể trở thành người bạn đồng hành lý tưởng trong những phút giây ấy.</p>

      <h3>1. Hương Thơm Từ Những Cánh Hoa Tinh Khiết</h3>
      <p>Trà hoa nhài được tạo nên từ sự kết hợp giữa lá trà chất lượng và những bông hoa nhài được tuyển chọn cẩn thận. Khi pha, hương thơm thanh khiết lan tỏa nhẹ nhàng trong không gian, mang đến cảm giác thư thái và dễ chịu.</p>
      <p>Mùi hương của hoa nhài không quá nồng mà rất tinh tế, giúp người thưởng trà cảm nhận được sự bình yên ngay từ những khoảnh khắc đầu tiên.</p>

      <h3>2. Khoảnh Khắc Thư Giãn Sau Một Ngày Dài</h3>
      <p>Sau những giờ học tập và làm việc căng thẳng, một tách trà hoa nhài ấm nóng có thể giúp bạn tìm lại sự cân bằng.</p>
      <ul>
        <li>Hít thật sâu hương thơm của trà.</li>
        <li>Thưởng thức từng ngụm nhỏ.</li>
        <li>Tạm gác điện thoại và những lo toan thường nhật.</li>
      </ul>
      <p>Chỉ vài phút ngắn ngủi cũng đủ để tâm trí trở nên nhẹ nhàng hơn.</p>

      <h3>3. Cách Pha Trà Hoa Nhài Ngon</h3>
      <ul>
        <li>Sử dụng nước ở nhiệt độ khoảng 80–85°C.</li>
        <li>Cho lượng trà vừa đủ theo khẩu vị.</li>
        <li>Ngâm trà từ 3–5 phút.</li>
        <li>Có thể thêm một chút mật ong để tăng vị ngọt tự nhiên.</li>
      </ul>
      <p><em>Không nên ngâm quá lâu vì sẽ làm vị trà trở nên đậm và mất đi sự thanh tao vốn có.</em></p>

      <h3>4. Thưởng Trà Như Một Nghệ Thuật Sống</h3>
      <p>Người yêu trà thường không uống trà chỉ để giải khát. Họ xem việc pha và thưởng trà là một khoảng thời gian dành riêng cho bản thân.</p>
      <p>Một cuốn sách hay, một bản nhạc nhẹ và một tách trà hoa nhài thơm dịu có thể biến một buổi chiều bình thường trở nên đặc biệt hơn rất nhiều.</p>
      <blockquote class="tea-quote">
        🌿 Floralia – Herbal Tea<br>
        "Nâng niu những khoảnh khắc an lành trong cuộc sống."
      </blockquote>
    `,
    author: "Kim Mộc",
    authorRole: "Tác giả văn hóa trà",
    date: "11 Tháng 6, 2024",
    publishedAt: new Date("2024-06-11"),
    category: "Thảo mộc trị liệu",
    categorySlug: "thao-moc-tri-lieu",
    image: "/assets/images/bl5.jpg",
    imageFileName: "bl5.jpg",
    featured: false,
    views: 890,
    readTime: "4 phút",
    tags: ["#TraHoaNhai", "#ThanhThoi", "#ThuGian", "#Floralia"]
  },
  {
    slug: "tra-va-nhung-buoi-chieu-binh-yen-khi-ta-hoc-cach-song-cham",
    title: "Trà Và Những Buổi Chiều Bình Yên – Khi Ta Học Cách Sống Chậm",
    excerpt: "Có những buổi chiều trôi qua thật nhanh trong tiếng chuông điện thoại, những cuộc họp liên tiếp... Khi ta học cách sống chậm, dành cho mình một khoảng thời gian nhỏ để tận hưởng.",
    content: `
      <p class="lead">Có những buổi chiều trôi qua thật nhanh trong tiếng chuông điện thoại, những cuộc họp liên tiếp và danh sách công việc chưa hoàn thành. Nhưng cũng có những buổi chiều mà ta chọn sống chậm lại, dành cho mình một khoảng thời gian nhỏ để nghỉ ngơi và tận hưởng hiện tại.</p>
      <p>Một tách trà thảo mộc có thể là khởi đầu cho khoảng thời gian quý giá ấy.</p>

      <h3>1. Vì Sao Nhiều Người Chọn Trà Vào Buổi Chiều?</h3>
      <p>Buổi chiều là thời điểm cơ thể bắt đầu cảm thấy mệt mỏi sau một ngày hoạt động. Một tách trà ấm giúp:</p>
      <ul>
        <li>Mang lại cảm giác thư giãn.</li>
        <li>Tạo khoảng nghỉ giữa các công việc.</li>
        <li>Giúp tâm trí trở nên nhẹ nhàng hơn.</li>
        <li>Tận hưởng những phút giây riêng tư và yên tĩnh.</li>
      </ul>
      <p>Đó không chỉ là việc uống trà, mà còn là cách để chăm sóc bản thân mỗi ngày.</p>

      <h3>2. Không Gian Hoàn Hảo Cho Một Tách Trà</h3>
      <p>Bạn không cần một quán trà sang trọng để có trải nghiệm thưởng trà trọn vẹn. Đó có thể là:</p>
      <ul>
        <li>Góc ban công đón gió chiều.</li>
        <li>Bàn làm việc sau khi hoàn thành công việc.</li>
        <li>Một chiếc ghế cạnh cửa sổ ngập nắng.</li>
        <li>Góc phòng quen thuộc với bản nhạc yêu thích.</li>
      </ul>
      <p>Điều quan trọng nhất không phải là nơi chốn, mà là cảm giác thư thái mà bạn tạo ra cho chính mình.</p>

      <h3>3. Những Loại Trà Phù Hợp Cho Buổi Chiều</h3>
      <ul>
        <li><strong>Trà hoa cúc:</strong> dịu nhẹ và dễ uống.</li>
        <li><strong>Trà bạc hà:</strong> mang lại cảm giác tươi mát.</li>
        <li><strong>Trà hoa nhài:</strong> hương thơm thanh tao.</li>
        <li><strong>Trà gừng quế:</strong> ấm áp và dễ chịu.</li>
      </ul>

      <h3>4. Sống Chậm Hơn Một Chút</h3>
      <p>Trong cuộc sống hiện đại, chúng ta thường vội vàng chạy theo những mục tiêu và kế hoạch phía trước. Nhưng đôi khi, điều quý giá nhất lại nằm trong những khoảnh khắc rất nhỏ: một ngụm trà ấm, một hơi thở sâu, một phút lặng yên để cảm nhận cuộc sống đang diễn ra.</p>
      <blockquote class="tea-quote">
        🌿 Floralia – Herbal Tea<br>
        "Mỗi tách trà là một khoảng lặng bình yên giữa nhịp sống hối hả."
      </blockquote>
    `,
    author: "Thương Oanh",
    authorRole: "Biên tập viên Floralia",
    date: "31 Tháng 5, 2024",
    publishedAt: new Date("2024-05-31"),
    category: "Phong cách sống",
    categorySlug: "phong-cach-song",
    image: "/assets/images/bl6.jpg",
    imageFileName: "bl6.jpg",
    featured: true,
    views: 1390,
    readTime: "4 phút",
    tags: ["#SongCham", "#ChieuBinhYen", "#HerbalTea", "#Floralia"]
  },
  {
    slug: "tra-gung-que-hoi-am-diu-dang-cho-nhung-ngay-mua",
    title: "Trà Gừng Quế – Hơi Ấm Dịu Dàng Cho Những Ngày Mưa",
    excerpt: "Có những ngày thời tiết trở nên se lạnh, những cơn mưa bất chợt khiến không gian trở nên trầm lắng hơn. Trong những khoảnh khắc ấy, một tách trà gừng quế nóng chính là người bạn đồng hành hoàn hảo.",
    content: `
      <p class="lead">Có những ngày thời tiết trở nên se lạnh, những cơn mưa bất chợt khiến không gian trở nên trầm lắng hơn. Trong những khoảnh khắc ấy, một tách trà gừng quế nóng chính là người bạn đồng hành hoàn hảo.</p>

      <h3>1. Sự Kết Hợp Của Hai Hương Vị Đặc Biệt</h3>
      <p>Gừng mang đến vị cay ấm tự nhiên, trong khi quế lại sở hữu hương thơm ngọt ngào và dễ chịu. Khi hòa quyện cùng nhau, chúng tạo nên một thức uống vừa đậm đà vừa tinh tế.</p>
      <p>Hương thơm lan tỏa từ tách trà không chỉ làm ấm cơ thể mà còn khiến tâm trạng trở nên thư thái hơn.</p>

      <h3>2. Khoảnh Khắc Lý Tưởng Để Thưởng Thức</h3>
      <p>Trà gừng quế đặc biệt phù hợp vào:</p>
      <ul>
        <li>Những buổi sáng se lạnh.</li>
        <li>Những ngày mưa cần một chút ấm áp.</li>
        <li>Buổi tối thư giãn sau ngày dài làm việc.</li>
        <li>Những lúc muốn tìm lại cảm giác bình yên.</li>
      </ul>
      <p>Chỉ cần vài phút ngồi yên cùng tách trà nóng, mọi căng thẳng dường như cũng dịu lại.</p>

      <h3>3. Cách Pha Trà Gừng Quế</h3>
      <ul>
        <li>Sử dụng nước ở nhiệt độ 90–95°C.</li>
        <li>Ngâm trà khoảng 5–7 phút.</li>
        <li>Có thể thêm mật ong để tăng vị ngọt tự nhiên.</li>
        <li>Thưởng thức khi trà còn ấm để cảm nhận trọn vẹn hương vị.</li>
      </ul>

      <h3>4. Một Chút Chậm Lại Giữa Cuộc Sống</h3>
      <p>Cuộc sống hiện đại khiến chúng ta luôn bận rộn với những kế hoạch và mục tiêu. Một tách trà gừng quế có thể không làm thay đổi cả ngày dài, nhưng đủ để mang lại vài phút bình yên cho tâm hồn.</p>
      <blockquote class="tea-quote">
        🌿 Floralia – Herbal Tea<br>
        "Lan tỏa sự ấm áp trong từng ngụm trà."
      </blockquote>
    `,
    author: "Phương Oanh",
    authorRole: "Chuyên gia trà thảo mộc",
    date: "15 Tháng 6, 2024",
    publishedAt: new Date("2024-06-15"),
    category: "Thảo mộc trị liệu",
    categorySlug: "thao-moc-tri-lieu",
    image: "/assets/images/bl7.jpg",
    imageFileName: "bl7.jpg",
    featured: false,
    views: 820,
    readTime: "4 phút",
    tags: ["#TraGungQue", "#NgayMua", "#HoiAmDiuDang", "#Floralia"]
  },
  {
    slug: "thuong-tra-cung-mot-cuon-sach-hay-trai-nghiem-cua-su-tinh-lang",
    title: "Thưởng Trà Cùng Một Cuốn Sách Hay – Trải Nghiệm Của Sự Tĩnh Lặng",
    excerpt: "Có những thú vui giản dị nhưng mang lại niềm hạnh phúc đặc biệt. Một trong số đó là ngồi xuống với một cuốn sách yêu thích và một tách trà thơm.",
    content: `
      <p class="lead">Có những thú vui giản dị nhưng mang lại niềm hạnh phúc đặc biệt. Một trong số đó là ngồi xuống với một cuốn sách yêu thích và một tách trà thơm.</p>

      <h3>1. Khi Trà Và Sách Gặp Nhau</h3>
      <p>Sách giúp mở rộng thế giới trong tâm trí, còn trà giúp làm dịu những bộn bề của cuộc sống. Sự kết hợp ấy tạo nên một không gian riêng, nơi bạn có thể tạm quên những lo toan và dành thời gian cho chính mình.</p>

      <h3>2. Chọn Loại Trà Phù Hợp</h3>
      <p>Mỗi loại trà đều mang đến một cảm xúc khác nhau:</p>
      <ul>
        <li><strong>Trà hoa cúc:</strong> nhẹ nhàng và thư giãn.</li>
        <li><strong>Trà hoa nhài:</strong> thanh tao và tinh tế.</li>
        <li><strong>Trà bạc hà:</strong> tươi mát và dễ chịu.</li>
        <li><strong>Trà gừng quế:</strong> ấm áp và sâu lắng.</li>
      </ul>
      <p>Bạn có thể lựa chọn loại trà phù hợp với tâm trạng và cuốn sách đang đọc.</p>

      <h3>3. Tạo Một Góc Nhỏ Bình Yên</h3>
      <p>Không cần quá cầu kỳ, chỉ cần:</p>
      <ul>
        <li>Một chiếc ghế thoải mái.</li>
        <li>Ánh sáng dịu nhẹ.</li>
        <li>Một cuốn sách yêu thích.</li>
        <li>Một tách trà nóng.</li>
      </ul>
      <p>Đó đã là đủ để tạo nên một khoảng thời gian đáng nhớ.</p>

      <h3>4. Tận Hưởng Từng Khoảnh Khắc</h3>
      <p>Đôi khi chúng ta quá bận rộn để nhận ra rằng những niềm vui nhỏ bé lại chính là điều làm nên chất lượng cuộc sống. Một trang sách hay, một ngụm trà thơm và vài phút tĩnh lặng có thể khiến cả ngày trở nên ý nghĩa hơn.</p>
      <blockquote class="tea-quote">
        🌿 Floralia – Herbal Tea<br>
        "Mang đến những phút giây thư thái từ những điều giản đơn."
      </blockquote>
    `,
    author: "Thương Oanh",
    authorRole: "Biên tập viên Floralia",
    date: "20 Tháng 6, 2024",
    publishedAt: new Date("2024-06-20"),
    category: "Văn hóa trà",
    categorySlug: "van-hoa-tra",
    image: "/assets/images/bl8.jpg",
    imageFileName: "bl8.jpg",
    featured: false,
    views: 940,
    readTime: "3 phút",
    tags: ["#SachVaTra", "#TinhLang", "#SongDep", "#Floralia"]
  },
  {
    slug: "nghe-thuat-thuong-tra-tim-lai-su-can-bang-trong-cuoc-song",
    title: "Nghệ Thuật Thưởng Trà – Tìm Lại Sự Cân Bằng Trong Cuộc Sống",
    excerpt: "Từ lâu, trà không chỉ đơn thuần là một loại thức uống. Đối với nhiều người, thưởng trà là một nghệ thuật sống, là cách để tìm lại sự cân bằng giữa nhịp sống hối hả.",
    content: `
      <p class="lead">Từ lâu, trà không chỉ đơn thuần là một loại thức uống. Đối với nhiều người, thưởng trà là một nghệ thuật sống, là cách để tìm lại sự cân bằng giữa nhịp sống hối hả.</p>

      <h3>1. Uống Trà Không Chỉ Để Giải Khát</h3>
      <p>Khi thưởng trà, người ta không vội vàng. Mỗi thao tác từ chuẩn bị nước, pha trà cho đến nhấp từng ngụm nhỏ đều được thực hiện chậm rãi và đầy sự trân trọng. Đó là khoảng thời gian để cơ thể nghỉ ngơi và tâm trí được thư giãn.</p>

      <h3>2. Lắng Nghe Bản Thân Qua Từng Tách Trà</h3>
      <p>Một tách trà nóng có thể giúp bạn:</p>
      <ul>
        <li>Thư giãn sau những giờ làm việc căng thẳng.</li>
        <li>Tạm rời xa những thiết bị điện tử.</li>
        <li>Dành thời gian suy ngẫm và lắng nghe chính mình.</li>
        <li>Tìm lại sự cân bằng trong cuộc sống thường ngày.</li>
      </ul>

      <h3>3. Biến Việc Uống Trà Thành Thói Quen Đẹp</h3>
      <p>Bạn có thể bắt đầu bằng những điều đơn giản:</p>
      <ul>
        <li>Uống một tách trà vào buổi sáng.</li>
        <li>Dành 10 phút nghỉ ngơi vào buổi chiều.</li>
        <li>Thưởng trà cùng gia đình hoặc bạn bè.</li>
        <li>Tận hưởng trà trong không gian yên tĩnh.</li>
      </ul>
      <p>Những thói quen nhỏ ấy sẽ góp phần tạo nên một lối sống tích cực và nhẹ nhàng hơn.</p>

      <h3>4. Hành Trình Của Sự Bình Yên</h3>
      <p>Mỗi tách trà là một lời nhắc nhở rằng chúng ta không cần phải vội vàng mọi lúc. Hãy cho bản thân cơ hội được sống chậm lại, hít thở sâu hơn và cảm nhận những điều tốt đẹp đang hiện diện xung quanh mình.</p>
      <p>Floralia tin rằng sự bình yên luôn bắt đầu từ những điều giản dị nhất – đôi khi chỉ là một tách trà thơm trong một buổi chiều yên ả.</p>
      <blockquote class="tea-quote">
        🌿 Floralia – Herbal Tea<br>
        "Mỗi tách trà là một hành trình trở về với sự an nhiên."
      </blockquote>
    `,
    author: "Floralia Team",
    authorRole: "Đội ngũ Floralia",
    date: "25 Tháng 6, 2024",
    publishedAt: new Date("2024-06-25"),
    category: "Văn hóa trà",
    categorySlug: "van-hoa-tra",
    image: "/assets/images/bl9.jpg",
    imageFileName: "bl9.jpg",
    featured: false,
    views: 1100,
    readTime: "5 phút",
    tags: ["#NgheThuatThuongTra", "#CanBang", "#AnNhien", "#Floralia"]
  }
];

async function seed() {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || "FloraliaTea");
    const blogsCol = db.collection("Blogs");

    console.log("Đã kết nối MongoDB Atlas. Đang cập nhật collection 'Blogs'...");

    // Thêm base64 imageData cho mỗi bài viết
    const docs = blogArticles.map(art => {
      const base64 = getBase64Image(art.imageFileName);
      return {
        ...art,
        imageData: base64,
        imageMimeType: "image/jpeg",
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    // Xóa dữ liệu cũ nếu có trong Blogs
    await blogsCol.deleteMany({});
    const res = await blogsCol.insertMany(docs);
    console.log(`Đã chèn thành công ${res.insertedCount} bài viết vào collection 'Blogs'!`);

    // Tạo index cho slug và search
    await blogsCol.createIndex({ slug: 1 }, { unique: true });
    await blogsCol.createIndex({ categorySlug: 1 });
    await blogsCol.createIndex({ featured: 1 });
    console.log("Đã tạo indexes cho 'Blogs' thành công!");

    // Thử truy vấn lại kiểm tra
    const count = await blogsCol.countDocuments();
    console.log("Tổng số bài viết hiện tại trong MongoDB:", count);
  } catch (err) {
    console.error("Lỗi khi seed Blogs:", err);
  } finally {
    await client.close();
  }
}

seed();
