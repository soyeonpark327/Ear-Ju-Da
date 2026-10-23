# 베테랑 카드 AI 예시 이미지

실존 인물을 참조하지 않은 가상 인물입니다. 실제 베테랑의 신원 사진이 아니며, 화면에서 ‘AI 예시’로 표시합니다. 사용자 등록 사진이 있으면 우선 사용하고, 사진이 없거나 로딩에 실패한 경우에만 이 이미지를 사용합니다. 데모에서는 새 예시 이미지를 사용합니다.

- [man-v1.jpg](man-v1.jpg): 안경을 쓴 60세 전후 남성
- [woman-v1.jpg](woman-v1.jpg): 58세 전후 여성
- [senior-v1.jpg](senior-v1.jpg): 은발의 65세 전후 남성

Built-in image_gen 도구로 각각 생성했습니다. 생성 원본은 Codex generated_images에 보존했으며, 프로젝트용으로 384×384 JPEG(약 28~30KB)로 최적화했습니다. 저장소의 가상 seed 인물은 예시 사진을 고정 배치하고, 그 외에는 ID로 선택합니다. 실제 인물의 모습을 재현한 것이 아닙니다.

## 최종 프롬프트

다음 공통 프롬프트의 `{subject}`에 아래 세 문장을 각각 넣어 생성했습니다.

```
Generate ONE realistic professional studio ID-style portrait for a website's illustrative expert avatar. Subject: {subject}. Head and upper chest centered, full head and shoulders inside frame with breathing room. Solid very light cool-gray background. Front-facing eye-level camera, soft balanced studio light, natural skin texture and age lines, restrained professional styling. Square composition. Entirely invented person, not based on any real person. No lettering, watermark, logo, badge, collage or border.
```

1. `fictional Korean man around age 60, short salt-and-pepper hair, thin glasses, navy business suit, white shirt, calm approachable expression`
2. `fictional Korean woman around age 58, short neat dark hair with subtle gray strands, charcoal blazer, ivory blouse, warm confident expression`
3. `fictional Korean man around age 65, neatly styled silver hair, no glasses, dark gray blazer, pale blue shirt, friendly experienced expression`
