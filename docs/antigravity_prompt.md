# Antigravity 구현 프롬프트 — 모두의 내일 진단 웹사이트 (Phase 0~3 전체 로드맵)

## 실행 지침 (가장 중요, 반드시 먼저 읽을 것)

이 문서는 Phase 0~3 전체 로드맵을 한 번에 보여주기 위한 것이지, 한 번에 다 구현하라는 뜻이 아니다.

- **지금 실행할 범위는 Phase 0뿐이다.** Phase 1~3은 방향을 미리 알려주기 위한 참고 정보이며, 지금 코드를 짜거나 스키마를 확장하지 않는다.
- Phase 0의 "완료 기준(DoD)"을 전부 만족하고, 사용자가 명시적으로 "Phase 1 시작해줘" 같은 확인을 준 뒤에만 다음 Phase로 넘어간다.
- Phase 0 구현 중에 Phase 1~3에 나오는 테이블(re_diagnosis_logs, citizen_reports)이나 기능을 미리 만들고 싶어질 수 있는데, 이번 범위에서는 만들지 않는다. 스키마 설계 시 "나중에 이런 게 추가될 수 있다" 정도만 염두에 두고, 실제 테이블 생성·화면 구현은 하지 않는다.
- Phase 0를 다 만들고 나면, 무엇을 완료했고 다음 Phase로 넘어가도 되는지(위 DoD 기준 대조)를 사용자에게 요약 보고하고 승인을 기다린다. 임의로 다음 Phase를 이어서 진행하지 않는다.

## 목표 (Objective)

접근성 진단 데이터를 지도·차트로 탐색하는 웹사이트를 만든다. 이번 작업 범위는 **Phase 0 (1주일 소프트 런칭)** 이며, 실제 서비스로 오픈하는 것이 목표다. 검증 안 된 기능(로그인, 재진단 자동알림, 기관 Dashboard)은 이번 범위에 포함하지 않는다.

## 확정된 기술 스택 (임의 변경 금지, 문제 있으면 먼저 보고)

- 프론트엔드: Next.js (App Router) + TypeScript + TailwindCSS
- 지도: 카카오맵 JS SDK (무료 쿼터 기준, 앱은 1개만 생성)
- 차트: Recharts (레이더차트, 막대그래프)
- 백엔드/DB: Supabase (PostgreSQL + PostGIS 익스텐션 활성화)
- 인증: Supabase Auth + RLS — 이번 Phase 0에서는 public(비로그인) 정책만 활성화
- AI: Claude API — 진단 요약 텍스트 생성에 한정 사용

## 데이터 모델 (Supabase 테이블)

```
zones
  id, name, level(enum: 대구역/중구역/소구역), parent_zone_id(FK self),
  polygon geometry(Polygon, PostGIS), final_index numeric, color_grade text

facilities
  id, name, zone_id(FK zones), address, location geometry(Point, PostGIS),
  facility_type text, last_survey_date date, status enum(공개/비공개/폐업)

measurements
  id, facility_id(FK), category enum(S1_보행로,S2_출입구,S3_화장실,S4_엘리베이터,S5_주차장),
  field_name text, value numeric, unit text, photo_url text, survey_date date

category_scores
  id, facility_id(FK), category enum(위와 동일), score numeric(0~100),
  status enum(계산완료/N_A/산출보류), calculated_at timestamptz

diagnosis_texts
  id, facility_id(FK), category enum(위와 동일), text text,
  source enum(AI생성/사람작성), review_status enum(확인필요/검수완료) default 확인필요,
  reviewed_by text, reviewed_at timestamptz
```

구역 소속 판정(어떤 facility가 어떤 zone에 속하는지)은 PostGIS의 `ST_Contains(zones.polygon, facilities.location)`으로 계산한다. zones.polygon은 구역 좌표 마킹 시트의 GPS 점들로 `ST_ConvexHull`을 적용해 생성한다.

## 점수 계산 로직 (그대로 구현, 임의 계수 변경 금지)

카테고리는 정확히 5개(S1~S5)이고, 세부 점수는 공통적으로 아래 선형보간 함수를 쓴다:

```
score(x, zeroPoint, hundredPoint) =
  clamp( (x - zeroPoint) / (hundredPoint - zeroPoint) * 100, 0, 100 )
```
(역산 항목은 zeroPoint가 hundredPoint보다 커서 자동으로 방향이 반대가 된다. 예: 단차는 zeroPoint=6, hundredPoint=2)

- **S1 보행로** = (1/3)·유효폭[0점40cm,100점120cm] + (1/3)·단차[0점6cm,100점2cm] + (1/3)·기울기[0점14.4도,100점4.8도]
- **S2 출입구** = 0.5·유효폭[0점30cm,100점90cm] + 0.5·단차경사로결합
  - 단차경사로결합: 단차≤2cm → 100점. 단차>2cm → 0.5·단차[0점6,100점2] + 0.5·경사로[0점14.4,100점4.8]
- **S3 화장실** = 0.25·가로너비[0점46.67cm,100점140cm] + 0.25·세로너비[0점46.67cm,100점140cm] + 0.25·문너비[0점30cm,100점90cm] + 0.25·단차경사로결합(S2와 동일 구조)
- **S4 엘리베이터** = 0.25·가로너비[0점53.33cm,100점160cm] + 0.25·세로너비[0점45cm,100점135cm] + 0.25·문너비[0점30cm,100점90cm] + 0.25·단차경사로결합(S2와 동일 구조, 탑승구 앞 기준)
- **S5 주차장** = 0.5·가로너비[0점110cm,100점330cm] + 0.5·세로너비[0점166.67cm,100점500cm]

**최종 넓이 지수 (facility 단위가 아닌 zone 단위, zone 내 facility S값 평균을 사용):**
```
FinalIndex = (S1·S2 + S2·S3 + S3·S4 + S4·S5 + S5·S1) / (5 × 10000) × 100
```

특정 카테고리에 데이터가 아예 없는 facility/zone은 해당 카테고리를 "N/A" 처리하고, zone의 FinalIndex는 계산하지 말고 "산출 보류"로 표기한다 (100점 등 임의 대입 금지).

## 구현할 화면 (F1~F4, 유저플로우 그대로)

1. **대구역/중구역 지도**: 카카오맵 위에 zones를 표시, final_index 기반 색상 그라데이션(구간 기준 미정이므로 우선 3단계 임시 구간을 쓰되 코드에서 쉽게 조정 가능한 상수로 분리해둘 것)
2. **소구역 진입 → 레이더차트**: 선택 zone의 S1~S5 표시, 카테고리 클릭 시 해당 zone 내 facility 접근성 순위 Top 10 (하위권 강조)
3. **측정요소 상세**: facility의 measurements 원본 수치, photo, diagnosis_texts 표시. `source=AI생성`이면 review_status와 무관하게 화면에 "확인 필요" 배지를 항상 노출(검수완료라도 AI생성 출처는 표시)
4. **세부조사항목 막대그래프**: zone 내 전체 measurements를 카테고리별로 막대그래프, 하위 n개 강조, 클릭 시 3번 화면으로 이동

## AI 진단 텍스트 생성 규칙

- Claude API에 넘기는 프롬프트는 반드시 해당 facility의 measurements 실측값만 컨텍스트로 제공하고, "제공된 수치 외의 값은 언급하지 말 것"을 명시적으로 지시한다.
- 생성된 텍스트는 diagnosis_texts에 `source=AI생성, review_status=확인필요`로 저장한다. 사람이 review_status를 수동으로 변경하기 전까지 화면에서 라벨을 유지한다.

## 이번 범위에서 하지 말아야 할 것 (Out of scope)

- 로그인/회원가입, 기관용 Dashboard(F6), 재진단 자동 알림, 시민 제보 기능 — 테이블 스키마는 위에 있는 대로 만들되 화면/로직은 구현하지 않는다
- 예산 시뮬레이션, 비용 추정 기능 일체

## 아직 확정 안 된 입력값 처리 방침

- 색상 그라데이션 실제 구간, AppSheet 실제 파일 구조는 아직 전달받지 못했다. 색상 구간은 임시 3단계(상수로 분리)로 구현하고, 데이터 입력은 CSV/xlsx 업로드로 구조를 유연하게 받는 import 스크립트를 만들어서 실제 AppSheet 파일이 오면 바로 매핑만 바꿔 꽂을 수 있게 한다. 이 두 가지는 하드코딩하지 말고 반드시 설정값/상수 파일로 분리할 것.

## 완료 기준 (Definition of Done) — Phase 0

- 소구역 1개 이상에 실데이터(또는 목업 데이터)가 채워진 상태로 F1→F2→F3→F4 흐름이 끊김 없이 동작
- 카테고리 점수·최종 지수가 하드코딩이 아닌 위 공식으로 실제 계산됨을 확인 가능
- AI 생성 진단 텍스트에 "확인 필요" 배지가 항상 표시됨
- 로컬에서 실행 확인 후 배포(Vercel 등) 가능한 상태

---

# Phase 1 — MVP 완성 (조사·표현 중심)

## 목표

Phase 0의 축소 범위를 정식 규모로 확장한다. 소구역 1~2곳 한정을 풀고, 여러 구역을 지원하며, 재진단 자동화와 AI 검수 워크플로우를 붙인다.

## 추가/변경 사항

- **F1~F5 전체 구현**: Phase 0에서 뺐던 F5(세부조사항목→측정요소 재귀 연결)까지 완성하고, 대구역·중구역 레벨에서 여러 zone을 동시에 지원하도록 지도 렌더링을 일반화한다.
- **AppSheet 연동 정식화**: 이번엔 실제 AppSheet 내보내기 파일 구조를 기준으로 import 스크립트를 확정한다 (Phase 0의 "임시 매핑"을 실제 매핑으로 교체). 매핑 근거를 코드 주석/문서로 남긴다.
- **재진단 자동 알림**: `re_diagnosis_logs` 테이블을 활용해, `facilities.last_survey_date` 기준 6개월~1년 경과를 감지하는 Supabase Edge Function(스케줄 트리거)을 만든다. 감지되면 담당자(내부 운영자)에게 이메일 또는 Slack 알림을 발송하고, `re_diagnosis_logs`에 `trigger_type=자동, status=예정` 레코드를 생성한다.
- **AI 검수 SLA 워크플로우**: 내부 운영자용 간단한 검수 화면(리스트 + 승인 버튼)을 만들어, `diagnosis_texts.review_status`를 확인필요→검수완료로 바꿀 수 있게 한다. 생성일로부터 7일 경과한 미검수 항목은 목록 상단에 경고 표시로 강조한다.
- **색상 구간·AppSheet 매핑 확정**: Phase 0에서 상수로 분리해둔 임시값을 실제 확정값으로 교체한다 (이 값은 사용자가 별도로 전달).

## 완료 기준 (DoD) — Phase 1

- 복수 소구역이 동시에 서비스되고, 유저플로우 F1~F5가 어떤 구역에서든 끊김없이 동작
- 재진단 자동 알림 Edge Function이 스케줄대로 실행되고 로그가 남음
- 내부 운영자가 검수 화면에서 AI 텍스트를 승인/반려할 수 있음

---

# Phase 2 — 기관 Dashboard & AI 확장

## 목표

로그인 기반 기관용 Dashboard(F6)를 만들고, 우선순위 설명·보고서 초안·데이터 품질 탐지 AI 기능을 추가한다.

## 추가/변경 사항

- **인증 정식 적용**: Supabase Auth로 기관 계정 로그인을 구현하고, RLS 정책을 `institution` role에 적용해 자기 소속 zone 데이터만 조회 가능하게 한다 (Phase 0/1의 public-only 정책에 institution 정책을 추가).
- **F6 Dashboard 6-View 구현**: 좌측 고정 사이드바(6개 뷰 전환) + 상단 컨텍스트바(zone/기간 선택, 보고서 다운로드 버튼) + 메인 패널 레이아웃. 지도·레이더차트·막대그래프는 F1~F5에서 만든 컴포넌트를 그대로 재사용한다.
  - 01 Overview: 진단 대상 수, 데이터 확보율, 평균 점수, 최신성 카드
  - 02 Spatial: 지도 + 시설유형/문제유형별 분포
  - 03 Problem & Diagnosis: 문제 빈도·패턴, AI 진단 근거 (확인필요 라벨 유지)
  - 04 Assessment: 시설별 점수·등급 테이블, 클릭 시 F3 상세로 드릴다운
  - 05 Priority & Decision: 우선순위 리스트 + AI-2 근거 설명
  - 06 Impact: Before/After 비교, 재진단·제보 이력 타임라인
- **AI-2 우선순위 근거 설명**: 하위권 facility에 대해 "왜 우선순위가 높은지"를 measurements/category_scores 근거로 생성, diagnosis_texts와 동일하게 확인필요 라벨 적용.
- **AI-4 보고서 초안 생성**: 상단 컨텍스트바의 "보고서" 버튼 클릭 시, 선택된 zone의 Overview~Impact 데이터를 종합해 Word/PDF 초안을 생성 (수치는 반드시 DB 값을 그대로 인용, 임의 생성 금지).
- **AI-5 데이터 품질 이상 탐지**: 배치 작업으로 중복 facility, 이상치(예: 단차 -5cm 같은 물리적으로 불가능한 값), 장기 미갱신 데이터를 탐지해 내부 운영자에게 알림.
- **Impact 데이터 축적**: category_scores에 이력을 남기는 구조로 바꿔(스냅샷 방식) 개선 전/후 비교가 가능하게 한다.

## 완료 기준 (DoD) — Phase 2

- 기관 계정으로 로그인 시 자기 zone 데이터만 보이고, RLS로 타 기관 데이터 접근이 차단됨을 확인
- 6-View 전환이 매끄럽게 동작하고 F1~F5 컴포넌트가 재사용됨
- 보고서 초안의 모든 수치가 DB 값과 1:1로 대조 가능

---

# Phase 3 — 생태계 확장

## 목표

시민 제보와 자연어 검색을 열어 데이터 확장 경로를 늘리고, 외부 연동을 위한 API를 준비한다.

## 추가/변경 사항

- **시민 제보 기능**: `citizen_reports` 테이블을 활용한 제보 접수 폼(비로그인 가능)을 F3 화면 등에 노출. 사진 업로드 지원.
- **AI-6 제보 자동 분류**: 제보 내용을 Claude API로 S1~S5 중 어느 카테고리에 해당하는지 자동 분류해 `classified_category`에 저장하고, 내부 운영자 검수 큐에 추가.
- **AI-3 자연어 검색**: facilities/measurements/diagnosis_texts를 임베딩해 벡터 검색 인덱스를 구성(Supabase pgvector 확장 활용). 사용자가 "휠체어로 갈 수 있는 카페" 같은 질의를 하면 벡터 검색 결과를 Claude API로 정리해 응답. 응답에도 근거 facility로 역추적 가능한 링크를 포함.
- **표준 API 검토**: 공개 데이터(zones, facilities 공개 필드, category_scores)에 한해 read-only REST 엔드포인트를 정식 문서화(OpenAPI)해 외부 연동 가능하게 한다.

## 완료 기준 (DoD) — Phase 3

- 시민이 로그인 없이 제보를 남길 수 있고, AI 분류 결과가 검수 큐에 정상적으로 쌓임
- 자연어 검색 질의에 대해 근거 facility가 함께 표시됨
- 공개 API 문서(OpenAPI)가 배포되어 있음

---

## 전체 범위에서 공통으로 지키는 원칙

- 어떤 Phase에서도 근거 없는 수치·점수·진단문구를 AI가 임의 생성하지 않는다 (5.4.4, 7장 Governance)
- AI 생성 콘텐츠는 항상 source=AI생성, 기본 review_status=확인필요로 저장한다
- 예산 시뮬레이션·비용 추정 기능은 어떤 Phase에도 포함하지 않는다 (Out of Scope 유지)

