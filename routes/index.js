var express = require('express');
var router = express.Router();
const crypto = require('crypto');
require('dotenv').config()

const orders = {};
const RespondType = 'JSON';

const { HASHIV, HASHKEY, MerchantID, Version, Host, ReturnURL, NotifyURL } = process.env;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// 建立訂單
router.post('/createOrder', (req, res) => {
  const data = req.body;
  const TimeStamp = Math.round(new Date().getTime() / 1000);
  orders[TimeStamp] = {
    ...data,
    TimeStamp,
    MerchantOrderNo: TimeStamp,
  }
  res.json(orders[TimeStamp]);
  console.log('TimeStamp', TimeStamp, orders)
})

// 確認訂單

router.get('/check', (req, res, next) => {
  res.render('check', {title: 'check'})
})

// 取得訂單資訊給前端
router.get('/order/:id', (req, res) => {
  const { id } = req.params;
  const order = orders[id];
  const aesEncrypt = create_mpg_aes_encrypt(order); // 交易資料
  console.log('aesEncrypt', aesEncrypt)

  const shaEncrypt = create_mpg_sha_encrypt(aesEncrypt); // 驗證用
  res.json({
    order,
    aesEncrypt,
    shaEncrypt
  });
})

router.post('/spgateway_return', (req, res) => {
  const data = req.body;
  res.render('success', { title: 'Success' });
  res.end();
})

router.post('/spgateway_notify', (req, res) => {
  const data = req.body;

  const info = create_mpg_aes_decrypt(data.TradeInfo)
  console.log('spgateway_notify', data)
  console.log('orders', orders[info.Result.MerchantOrderNo])
  res.end();
})

module.exports = router;
function genDataChain(order) {
  return `MerchantID=${MerchantID}&RespondType=${RespondType}&TimeStamp=${order.TimeStamp}&Version=${Version}&MerchantOrderNo=${order.MerchantOrderNo}&Amt=${order.amt}&ItemDesc=${encodeURIComponent(order.itemDesc)}&Email=${encodeURIComponent(order.email)}`;
}

// $edata1=bin2hex(openssl_encrypt($data1, "AES-256-CBC", $key, OPENSSL_RAW_DATA, $iv));
function create_mpg_aes_encrypt(TradeInfo) { // 訂單資料傳入，商品資料的加密
  const encrypt = crypto.createCipheriv('aes256', HASHKEY, HASHIV);
  const enc = encrypt.update(genDataChain(TradeInfo), 'utf8', 'hex');
  return enc + encrypt.final('hex');
}

// 對應文件 P17：使用 sha256 加密
// $hashs="HashKey=".$key."&".$edata1."&HashIV=".$iv;
function create_mpg_sha_encrypt(aesEncrypt) {
  const sha = crypto.createHash('sha256');
  const plainText = `HashKey=${HASHKEY}&${aesEncrypt}&HashIV=${HASHIV}`;

  return sha.update(plainText).digest('hex').toUpperCase();
}

// 將 aes 解密
function create_mpg_aes_decrypt(TradeInfo) {
  const decrypt = crypto.createDecipheriv('aes256', HASHKEY, HASHIV);
  decrypt.setAutoPadding(false);
  const text = decrypt.update(TradeInfo, 'hex', 'utf8');
  const plainText = text + decrypt.final('utf8');
  const result = plainText.replace(/[\x00-\x20]+/g, '');
  return JSON.parse(result);
}
