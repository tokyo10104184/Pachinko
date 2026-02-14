# Pachinko Discord Slot BOT

Discord BOTとして動作する、本格的なスロットゲームです。`/slot` で遊べる経済システム・ジャックポット・フリースピンを搭載しています。

## 主な機能
- `/slot bet:<金額>`: スロットを回す（クールダウンあり）
- `/daily`: 24時間ごとのデイリー報酬（連続ログインボーナス）
- `/balance`: 所持金表示
- `/rank`: 所持金ランキング
- `/jackpot`: ジャックポット総額表示
- `/help_slot`: 役と倍率の説明

## ゲーム仕様
- シンボルごとの重み付き抽選
- 通常役（3つ揃い）
- ワイルド（🃏）による高倍率ボーナス
- スキャッター（🎰）でフリースピン
- `777` でジャックポット抽選
- 毎スピンで賭け金の 2% がジャックポットへ積立

## セットアップ
```bash
npm install
cp .env.example .env
# .env を編集
npm run build
npm start
```

## GCE デプロイ（推奨）
### 1) VM作成
- Debian/Ubuntu系のCompute Engine VMを作成
- ファイアウォールは外向き通信可能であればOK（Discord APIへ接続）

### 2) Node.js導入
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
```

### 3) 配置
```bash
git clone <your-repo-url>
cd Pachinko
npm ci
cp .env.example .env
# .env 設定
npm run build
```

### 4) systemd化
`/etc/systemd/system/pachinko-bot.service`
```ini
[Unit]
Description=Pachinko Discord Slot Bot
After=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Pachinko
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable pachinko-bot
sudo systemctl start pachinko-bot
sudo systemctl status pachinko-bot
```

## 注意
- Discord Developer PortalでBOT権限と`applications.commands`スコープを設定してください。
- `GUILD_ID` を設定するとスラッシュコマンド反映が早くなります。
