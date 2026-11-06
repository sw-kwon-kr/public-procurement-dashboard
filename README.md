# Public Procurement Dashboard

로컬 DATA 폴더의 CSV를 갱신 프로그램이 분석·검증하고, 게시된 결과를 확인하는 정적 대시보드입니다. 브라우저 CSV 업로드 기능은 제공하지 않습니다.

## 데이터 갱신

PC의 updater가 특정품목·혁신 CSV를 읽어 같은 계약의 최종 증감 금액을 정리하고 manifest.json과 contracts.json을 게시합니다. 매월 1일 오전 9시가 평일인 경우 자동 실행하며 주말이면 건너뜁니다. 수동 갱신은 로컬 updater의 Update-publish.lnk를 사용합니다.

화면에는 자료 반영 시각, 계약기간, 원본 파일명, 데이터 버전과 검증 결과가 표시됩니다. 공개 화면은 마지막으로 게시된 자료를 보여주며 PC 폴더나 예약 작업 상태를 실시간 조회하지 않습니다.

## 로컬 확인

검증된 data/manifest.json과 data/contracts.json을 준비한 뒤 node server.mjs로 실행합니다. 기본 주소는 http://localhost:5174/ 입니다.

## Vercel 새 프로젝트

GitHub 저장소 sw-kwon-kr/public-procurement-dashboard를 Import합니다.

- Framework Preset: Other
- Root Directory: 저장소 루트
- Build Command: node build.mjs
- Output Directory: site
- Install Command: 비움 (vercel.json에서 건너뛰도록 지정)
- Production Branch: main
- 별도 API 키·환경변수 불필요

vercel.json이 빌드·출력·캐시 설정을 관리합니다. 빌드는 검증된 JSON과 화면 자산만 site에 복사하며 원본 CSV와 로컬 운영 파일은 포함하지 않습니다.

Vercel이 GitHub에 연결되면 로컬 updater의 main push가 새 배포를 시작합니다. Vercel 공개 주소가 확정된 뒤 updater/config.json의 publicUrl을 끝에 /가 있는 해당 주소로 변경하고 게시 버전 확인을 실행해야 전환이 완료됩니다. 현재 운영 주소는 프로젝트 연결 전까지 기존 GitHub Pages 주소입니다.

공식 문서: https://vercel.com/docs/project-configuration/vercel-json , https://vercel.com/docs/git
