import mongoose from "mongoose";
import Setting from "../models/setting.model";
import dotenv from "dotenv";
dotenv.config();


const MONGODB_URI = process.env.DATABASE || "mongodb://localhost:27017/TeddyPet";


const seedData = [
    {
        key: "page-about",
        data: {
            title: "Về chúng tôi - Câu chuyện của TeddyPet",
            content: `
                <p>Chào mừng bạn đến với <strong>TeddyPet</strong> – nơi tình yêu dành cho thú cưng được đặt lên hàng đầu! Chúng tôi không chỉ là một cửa hàng, mà là cộng đồng của những người yêu động vật, mong muốn mang lại những điều tốt đẹp nhất cho những người bạn bốn chân.</p>
                <h3>Tầm nhìn của chúng tôi</h3>
                <p>Tại TeddyPet, chúng tôi tin rằng mỗi thú cưng đều xứng đáng có một cuộc sống khỏe mạnh và hạnh phúc. Chúng tôi cam kết cung cấp các sản phẩm chất lượng cao nhất, từ thực phẩm dinh dưỡng đến các dịch vụ chăm sóc chuyên nghiệp.</p>
                <img src="https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=800" alt="Pet Shop" style="width: 100%; border-radius: 12px; margin: 20px 0;" />
                <h3>Tại sao chọn TeddyPet?</h3>
                <ul>
                    <li><strong>Sản phẩm đa dạng:</strong> Từ thức ăn, phụ kiện đến đồ chơi độc đáo.</li>
                    <li><strong>Dịch vụ tận tâm:</strong> Đội ngũ nhân viên giàu kinh nghiệm và yêu thương động vật.</li>
                    <li><strong>Giá cả hợp lý:</strong> Phù hợp với mọi nhu cầu của khách hàng.</li>
                </ul>
                <p>Hãy để TeddyPet trở thành người bạn đồng hành tin cậy trong hành trình chăm sóc thú cưng của bạn!</p>
            `
        }
    },
    {
        key: "page-faq",
        data: {
            title: "Câu hỏi thường gặp (FAQ)",
            content: "<p>Chúng tôi đã tổng hợp các câu hỏi phổ biến nhất để giúp bạn có trải nghiệm mua sắm tốt nhất tại TeddyPet.</p>",
            items: [
                {
                    question: "Làm thế nào để tôi có thể đặt hàng?",
                    answer: "Bạn chỉ cần chọn sản phẩm yêu thích, thêm vào giỏ hàng và thực hiện các bước thanh toán đơn giản trên website. Chúng tôi sẽ liên hệ lại để xác nhận đơn hàng."
                },
                {
                    question: "TeddyPet có giao hàng tận nhà không?",
                    answer: "Có, chúng tôi hỗ trợ giao hàng toàn quốc. Đối với các đơn hàng trong nội thành, thời gian giao hàng thường từ 1-2 ngày làm việc."
                },
                {
                    question: "Tôi có thể hủy đơn hàng sau khi đã đặt không?",
                    answer: "Bạn có thể hủy đơn hàng trong vòng 2 giờ kể từ khi đặt nếu đơn hàng chưa được vận chuyển. Vui lòng liên hệ hotline để được hỗ trợ nhanh nhất."
                },
                {
                    question: "Chính sách tích điểm thành viên là gì?",
                    answer: "Với mỗi đơn hàng hoàn tất, bạn sẽ được tích lũy điểm thưởng dựa trên giá trị hóa đơn. Điểm này có thể dùng để giảm giá cho các đơn hàng tiếp theo."
                }
            ]
        }
    },
    {
        key: "page-privacy",
        data: {
            title: "Chính sách bảo mật thông tin",
            content: `
                <p>TeddyPet cam kết bảo vệ tuyệt đối thông tin cá nhân của khách hàng. Chính sách này mô tả cách chúng tôi thu thập và sử dụng dữ liệu của bạn.</p>
                <h4>1. Thu thập thông tin</h4>
                <p>Chúng tôi thu thập thông tin khi bạn đăng ký tài khoản, đặt hàng hoặc nhận bản tin email.</p>
                <h4>2. Sử dụng thông tin</h4>
                <p>Dữ liệu của bạn được sử dụng để xử lý đơn hàng, cải thiện dịch vụ và gửi các thông tin ưu đãi phù hợp.</p>
                <h4>3. Cam kết bảo mật</h4>
                <p>Chúng tôi sử dụng các biện pháp an ninh tiên tiến để đảm bảo thông tin của bạn không bị truy cập trái phép.</p>
            `
        }
    },
    {
        key: "page-terms",
        data: {
            title: "Điều khoản & Điều kiện sử dụng",
            content: `
                <p>Khi sử dụng website TeddyPet, bạn đồng ý tuân thủ các điều khoản sau đây:</p>
                <ul>
                    <li>Thông tin trên website này có thể thay đổi mà không cần thông báo trước.</li>
                    <li>Sản phẩm hiển thị có thể có sự khác biệt nhỏ về màu sắc do thiết bị hiển thị.</li>
                    <li>Mọi hành vi sao chép nội dung từ website mà không có sự đồng ý đều là vi phạm bản quyền.</li>
                </ul>
            `
        }
    },
    {
        key: "page-shipping",
        data: {
            title: "Chính sách vận chuyển & Giao nhận",
            content: `
                <p><strong>Thời gian giao hàng:</strong> Mỗi đơn hàng sẽ được xử lý trong vòng 24 giờ.</p>
                <p><strong>Phí vận chuyển:</strong> Phí ship sẽ được tính tự động dựa trên vị trí của bạn và khối lượng đơn hàng thông qua đơn vị vận chuyển GoShip.</p>
                <p><strong>Kiểm tra hàng:</strong> Khách hàng được quyền kiểm tra tình trạng bên ngoài của gói hàng trước khi nhận.</p>
            `
        }
    },
    {
        key: "page-returns",
        data: {
            title: "Chính sách đổi trả & Hoàn tiền",
            content: `
                <p>Chúng tôi hỗ trợ đổi trả sản phẩm trong vòng <strong>7 ngày</strong> kể từ khi nhận hàng với các điều kiện sau:</p>
                <ol>
                    <li>Sản phẩm còn nguyên tem mác, chưa qua sử dụng.</li>
                    <li>Sản phẩm bị lỗi do nhà sản xuất hoặc hư hại trong quá trình vận chuyển.</li>
                    <li>Đổi trả do nhu cầu cá nhân: Khách hàng vui lòng thanh toán phí ship 2 chiều.</li>
                </ol>
                <p>Tiền sẽ được hoàn lại vào tài khoản của bạn trong vòng 3-5 ngày làm việc sau khi chúng tôi nhận lại hàng.</p>
            `
        }
    }
];


const seed = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        for (const item of seedData) {
            await Setting.findOneAndUpdate(
                { key: item.key },
                item,
                { upsert: true, new: true }
            );
            console.log(`Seeded: ${item.key}`);
        }

        console.log("Seeding completed successfully");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seed();
