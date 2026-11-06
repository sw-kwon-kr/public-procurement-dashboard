# Public Procurement Dashboard

로컬 DATA 폴더의 CSV를 갱신 프로그램이 분석·검증하고, 게시된 결과를 확인하는 정적 대시보드입니다. 브라우저 CSV 업로드 기능은 제공하지 않습니다.

## 데이터 갱신

PC의 updater가 특정품목·혁신 CSV를 읽어 같은 계약의 최종 증감 금액을 정리하고 manifest.json과 contracts.json을 게시합니다. 매월 1일 오전 9시가 평일인 경우 자동 실행하며 주말이면 건너뜁니다. 수동 갱신은 로컬 updater의 Update-publish.lnk를 사용합니다.

화면에는 자료 반영 시각, 계약기간과 검증 결과가 표시됩니다. 데이터 버전과 원본 파일명은 화면에 표시하지 않으며 내부 배포 검증용 manifest에 유지합니다. 계약업체 현황은 타일형과 가로 막대 리스트형을 선택할 수 있습니다. 리스트는 선택 지표가 높은 순으로 전체 해당 업체를 표시하며 업체 선택 시 하단 상세와 연결됩니다. 공개 화면은 마지막으로 게시된 자료를 보여주며 PC 폴더나 예약 작업 상태를 실시간 조회하지 않습니다.

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

운영 주소는 https://public-procurement-dashboard.vercel.app/ 입니다. Vercel과 GitHub가 연결되어 로컬 updater의 main push가 새 배포를 시작합니다. updater/config.json의 publicUrl도 이 주소로 설정하여 실제 Vercel 데이터 버전과 해시를 확인합니다. 매월 1일 평일 예약과 수동 갱신은 동일한 게시 경로를 사용합니다.

공식 문서: https://vercel.com/docs/project-configuration/vercel-json , https://vercel.com/docs/git
