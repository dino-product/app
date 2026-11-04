// 테스트는 서울 시간대로 돈다. 서버 UTC 시각을 기기 현지 시각으로 바꾸는 테스트가 CI(UTC)와 개발 기기에서 같은 값을 본다.
// 테스트 안에서 process.env.TZ 를 바꿔도 jest 샌드박스라 시간대가 바뀌지 않아, 워커를 띄우기 전에 정한다
module.exports = () => {
  process.env.TZ = 'Asia/Seoul';
};
