# ---- 1. 베이스 이미지 ----
FROM node:18-alpine

# ---- 2. 앱 디렉토리 생성 ----
WORKDIR /app

# ---- 3. package.json만 먼저 복사해서 종속성 캐싱 ----
COPY package*.json ./

# ---- 4. 의존성 설치 ----
RUN npm install

# ---- 5. 앱 소스 복사 ----
COPY . .

# ---- 6. 포트 노출 (Express 기본 5000) ----
EXPOSE 5000

# ---- 7. 앱 시작 ----
CMD ["npm", "start"]
