```bash
git clone <your-repo-url> ./Burn-WebSite
cd Burn-WebSite
```

```bash
npm install
```

```bash
cd backend
npm install
copy .env.example .env
npx prisma generate
npx prisma db push
```

```bash
cd ../frontend
npm install
```

```bash
cd ..
npm run dev
```
