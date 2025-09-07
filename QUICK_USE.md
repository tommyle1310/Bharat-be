5) Cách dùng (quick commands)

Trên server Ubuntu (luôn dùng .env.test):

# upload repo + .env.test to server (đảm bảo .env.test có DB_HOST thật)
npm i
chmod +x indus-deploy.sh
./indus-deploy.sh start --env .env.test

B1. Start Redis container đúng network
Từ thư mục buyer-service, chạy:
docker compose -f docker-compose.redis.yml up -d


# kiểm tra
./indus-deploy.sh status
./indus-deploy.sh logs


Khi port 1310 đang có listener, script sẽ in ra và hỏi:

Nếu listener là container (không phải của project), script hỏi Do you want to stop that container — nếu chọn y, nó sẽ docker stop + docker rm.

Nếu listener là process (PID), script sẽ liệt kê PID(s) và hỏi Do you want to kill these PID(s)? — nếu chọn y, script sẽ sudo kill -9 PID.

Nếu bạn trả n, script sẽ abort start (vì bạn bắt buộc phải dùng 1310).

Trên local dev, nếu muốn dùng local mysql:

./indus-deploy.sh start --env .env.test --prefer-local-db


Check log bằng:
docker logs -f indus_auction_system_buyer_service_backend
