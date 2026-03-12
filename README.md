# dmdata-quake-node-server

[Project DM-D.S.S (DMData)](https://dmdata.jp/) の WebSocket API から緊急地震速報（地震動予報 / VXSE45）をリアルタイムで受信し、外部の MongoDB と連携しながら Web UI および WebSocket サーバーとして配信する Node.js サーバーです。

## 注意

- このソフトウェアのご利用には、Project DM-D.S.S の「緊急地震（予報）」区分への契約が必要です。
- Project DM-D.S.S の利用規約および API 利用規約を遵守してください。特に、法人契約を行なっていない場合、緊急地震速報の二次配信が厳しく制限されることにご注意ください。詳しくは [サービス利用規約 - 15. EEWの二次配信](https://dmdata.jp/terms/#15-eew%E3%81%AE%E4%BA%8C%E6%AC%A1%E9%85%8D%E4%BF%A1) をご確認ください。

## 機能

- DMData API への OAuth2 認証（クライアントクレデンシャル方式）
- DMData WebSocket API からのリアルタイム電文受信・保存
- 受信した緊急地震速報（VXSE45）の MongoDB への蓄積
- Express による Web UI の提供
  - `/` — 最新の緊急地震速報を表示
  - `/list` — 受信済みイベントの一覧を表示
  - `/api/list` — イベント一覧 API
- WebSocket サーバー（ポート 6500）によるリアルタイムデータ配信

## サンプル画像

![](/docs/screenshot-list.png)

## 必要環境

| 依存            | バージョン |
| --------------- | ------------------- |
| Node.js         | v22 以上 |
| MongoDB         | 最新バージョン |

## セットアップ

### 0. DMData API クレデンシャルの取得

DMData API を利用するには、OAuth クライアント（機密）のクレデンシャル（API クライアント ID とシークレットキー）が必要です。
これらは [DMData 管理画面](https://control.dmdata.jp/dev/credentials) から作成・取得できます。

使用するスコープは以下の通りです。

- `eew.get.forecast` - 緊急地震速報（地震動予報）を取得するために必要
- `socket.start` - WebSocket 通信を開始するために必要

リダイレクト URI は `http://localhost/code` に設定してください。

使用するフローは `クライアントクレデンシャルフロー` です。

### 1. リポジトリをクローン

```bash
git clone https://github.com/looksky495/dmdata-quake-node-server.git
cd dmdata-quake-node-server
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、DMData の OAuth 認証情報を記載します。

```env
API_CLIENT_ID=your_client_id
API_SECRET_KEY=your_secret_key
```

| 変数名           | 説明                             |
| ---------------- | -------------------------------- |
| `API_CLIENT_ID`  | DMData API のクライアント ID      |
| `API_SECRET_KEY` | DMData API のシークレットキー     |

### 4. MongoDB の起動

ローカルで MongoDB を起動するか、MongoDB Atlas などのクラウドサービスを利用してください。
MongoDB の接続先はコマンドラインオプションで指定できます（デフォルトは `localhost:27017`）。

```bash
# ローカル MongoDB の起動例
mongod --dbpath /path/to/data/db

# Docker を利用する場合
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. サーバーの起動

```bash
npm run start
```

初回起動時（または DB を初期化したい場合）は `--init` オプションを付けて起動してください。

```bash
node -r dotenv/config index.js --init
```

## コマンドラインオプション

```
Usage: node index.js [options]

Options:
  -i, --init      データベースを初期化する
  -h, --help      ヘルプを表示する
  -v, --version   バージョン情報を表示する
  -p, --port      HTTP サーバーのポート番号 (default: 80)
  -d, --dbhost    MongoDB のホスト (default: localhost:27017)
```

### 使用例

```bash
# ポート 3000 で起動
node -r dotenv/config index.js --port 3000

# MongoDB の接続先を指定して起動
node -r dotenv/config index.js --dbhost 192.168.1.10:27017

# データベースを初期化してから起動
node -r dotenv/config index.js --init

# ヘルプを表示
node -r dotenv/config index.js --help
```

## WebSocket サーバー（クライアント向け）

サーバーはポート **6500** で WebSocket 接続を待ち受けます。
接続後、以下のメッセージを送受信できます。

| メッセージタイプ | 方向            | 説明                               |
| ---------------- | --------------- | ---------------------------------- |
| `ping`           | クライアント → サーバー | 疎通確認 ping                     |
| `pong`           | サーバー → クライアント | ping への応答                     |
| `list`           | クライアント → サーバー | イベント一覧のリクエスト           |
| `list`           | サーバー → クライアント | イベント一覧データの返信           |

## データベース構成（MongoDB）

データベース名: `dmdata-quake-node-server`

| コレクション名    | 内容                                     |
| ----------------- | ---------------------------------------- |
| `vxse45-raw`      | 受信した VXSE45 電文の生データ           |
| `vxse45-latest`   | イベントごとの最新 VXSE45 電文           |
| `vxse45-list`     | イベント一覧（簡易メタデータ）           |

## ライセンス

[MIT](LICENSE)
