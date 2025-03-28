# 영상 자막 번역 프로그램

## 필요 조건

- Node.js (v14 이상 권장)
- npm 또는 yarn

## 설치 방법

```bash
# 패키지 설치
npm install
```

## 사용 방법

프로그램은 다음과 같은 형식으로 실행합니다:

```bash
npm run start "입력 파일 경로" ["출력 디렉토리 경로"]
```

- `입력 파일 경로`: 처리할 동영상 파일의 경로 (필수)
- `출력 디렉토리 경로`: 처리된 파일이 저장될 디렉토리 경로 (선택, 기본값: 입력 파일과 같은 디렉토리)

### 예시

1. 기본 사용법 (출력 파일은 입력 파일과 같은 디렉토리에 생성):

```bash
npm run start "./videos/input.mp4"
```

2. 출력 디렉토리 지정:

```bash
npm run start "./videos/input.mp4" "./output"
```

### 출력 파일

처리된 영상은 입력 파일명에 "\_subtitle"이 추가된 형태로 저장됩니다.
예: `input.mp4` -> `input_subtitle.mp4`

## 구조

- `src/index.ts`: 메인 코드
- `input/`: 입력 영상을 넣는 폴더
- `output/`: 처리된 영상이 저장되는 폴더
