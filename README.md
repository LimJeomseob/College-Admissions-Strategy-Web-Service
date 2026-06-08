# College-Admissions-Strategy-Web-Service

5등급제 학생의 **9등급 입결 기반 대입 전략** 웹 서비스 — 데이터 기반 진학 컨설팅 자동화 플랫폼.

2028 대입을 준비하는 학생은 5등급제로 성적을 받지만, 축적된 수시 입결은 모두 9등급제 기준이다.
이 서비스는 두 체계의 '환산 단절'을 해소하고, 성적 입력 한 번으로 **지원 가능 대학·학과 + 교과전형 준비전략**을
도출한다. 성적 연산은 모두 **브라우저(클라이언트)에서** 수행되어 서버에 저장되지 않는다.

## 범위 (Phase 0 + 1 · MVP)
1. 전 과목 내신성적 입력 → 반영과목 4종 조합(전과목 / 국수영사과 / 국수영사 / 국수영과) 가중평균
2. 5등급 → 9등급 환산 (50:50 통합 모형, 선형 보간, 외삽 경고)
3. 지원 가능 대학·학과 추출 (안정/적정/소신 3구간, 입결 미공개 분리)
4. 교과전형 준비전략 (수도권 31개교, 반영방법 재투영 유불리 진단)

> **분기 규칙**: 추정 9등급이 3.5보다 낮으면(등급 숫자 ≥ 3.5) 종합전형은 사실상 불필요로 보고 교과전형에 집중.
> 종합전형(5단계)·PDF 리포트·추세 시각화는 Phase 2~3 확장 과제.

## 기술 스택
React 18 + Vite + TypeScript (정적 클라이언트). 빌드 타임 ETL이 5종 DB를 정규화 JSON으로 변환.

## 개발
```bash
npm install
npm run etl:mock   # 샘플 데이터 생성 (실데이터 없을 때)
npm run dev        # 개발 서버
npm test           # 엔진 단위 테스트
npm run build      # 타입체크 + 프로덕션 빌드
```

실제 5종 DB는 `data/raw/`에 업로드 후 `npm run etl` 실행 (자세한 내용: `data/README.md`).

## 구조
```
scripts/etl/   Phase 0 ETL (대학명 표준화·입결 정제·환산 보간·교과 인덱스)
src/engine/    엔진 계층 — 순수 함수 (grade/convert/match/triage/subjectStrategy)
src/components/ 입력 폼 · 결과 리스트 · 전략 카드
src/config/    상수 (분기 임계값 3.5, 매칭 여유분, 면책 문구)
public/data/   ETL 산출물(dataLayer.json) — 클라이언트 로드
```

배포: `main` 브랜치 push 시 GitHub Actions가 GitHub Pages로 배포 (`.github/workflows/deploy.yml`).
