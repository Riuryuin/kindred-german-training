# Kindred German Voice Training — iPhone Web App

## 구성
- index.html
- style.css
- app.js
- sentences.csv
- audio/  ← 기존 001.wav ~ 178.wav 등을 이 폴더에 넣습니다.

## 로컬 테스트
Python이 설치되어 있다면 이 폴더에서:

python -m http.server 8000

PC에서:
http://localhost:8000

## iPhone에서 사용
웹호스팅에 업로드한 뒤 HTTPS 주소로 Safari에서 접속합니다.

## 주의
Safari 마이크 녹음은 HTTPS 같은 보안 컨텍스트에서 사용하는 것이 중요합니다.
현재 버전의 녹음은 브라우저에서 임시 생성하며, "녹음 저장"을 누르면 파일로 저장할 수 있습니다.
서버에 녹음을 자동 보관하는 기능은 아직 포함하지 않았습니다.

## 오디오
sentences.csv의 file 값이 audio/001.wav 같은 경로를 가리키므로,
기존 audio 폴더를 이 프로젝트의 audio/ 폴더에 그대로 복사하면 됩니다.
