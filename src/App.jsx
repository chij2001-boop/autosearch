import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

// 🎯 이사님의 biology-question-parser 프로젝트 실제 키셋 주입 완료
const firebaseConfig = {
  apiKey: "AIzaSyCHp28l-zYv5nZ3pgkaTpK-dPRVSN5cevs",
  authDomain: "biology-question-parser.firebaseapp.com",
  projectId: "biology-question-parser",
  storageBucket: "biology-question-parser.firebasestorage.app",
  messagingSenderId: "983881153501",
  appId: "1:983881153501:web:3315c85d1f4658f9cd1434",
  measurementId: "G-SQBFGSSK2K"
};

// 시스템 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  const [image, setImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepStatus, setStepStatus] = useState(''); 
  const [progress, setProgress] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  
  const canvasRef = useRef(null);

  // 고대비 그래픽 전처리 필터
  const preprocessImage = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
          const v = brightness > 125 ? 255 : 0; 
          data[i] = v;     
          data[i + 1] = v; 
          data[i + 2] = v; 
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL());
      };
    });
  };

  // 자카드 자연어 유사도 계산 엔진
  const calculateSimilarity = (arr1, arr2) => {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size === 0 ? 0 : (intersection.size / union.size) * 100;
  };

  // 생물학 키워드 토큰화 가속기
  const tokenizeText = (rawText) => {
    return rawText
      .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      if (image) URL.revokeObjectURL(image); 
      const url = URL.createObjectURL(e.target.files[0]);
      setImage(url);
      setProcessedImage(null);
      setText('');
      setSearchResults([]);
      setStepStatus('');
    }
  };

  // 데이터 파이프라인 자동화 컨트롤러
  const handleAiAnalysis = async () => {
    if (!image) return;
    setLoading(true);
    
    try {
      setStepStatus('ENGINE_PREPROCESSING');
      const enhancedImg = await preprocessImage(image);
      setProcessedImage(enhancedImg);

      setStepStatus('ENGINE_OCR');
      const { data: { text: ocrResult } } = await Tesseract.recognize(enhancedImg, 'kor+eng', {
        logger: m => m.status === 'recognizing text' && setProgress(Math.round(m.progress * 100))
      });
      setText(ocrResult);

      setStepStatus('ENGINE_SEARCH');
      const inputKeywords = tokenizeText(ocrResult);
      
      if (inputKeywords.length === 0) {
        setSearchResults([]);
        setStepStatus('NO_KEYWORDS');
        setLoading(false);
        return;
      }

      const q = query(collection(db, "problems"), where("keywords", "array-contains-any", inputKeywords.slice(0, 10)));
      const querySnapshot = await getDocs(q);
      
      const candidates = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const score = calculateSimilarity(inputKeywords, data.keywords);
        candidates.push({ id: doc.id, ...data, matchScore: Math.round(score) });
      });

      candidates.sort((a, b) => b.matchScore - a.matchScore);
      setSearchResults(candidates);
      setStepStatus(candidates.length > 0 ? 'SUCCESS' : 'EMPTY');

    } catch (err) {
      console.error(err);
      setStepStatus('ERROR');
    } finally {
      setLoading(false);
    }
  };

  // 프리미엄 데이터 주입 팩
  const seedDatabase = async () => {
    const biologyDatabase = [
      {
        questionText: "세포 호흡 과정에서 미토콘드리아 내막을 통한 전자 전달계와 화학 삼투로 생성되는 1분자의 글루코스당 대략적인 ATP 수는?",
        keywords: ["세포", "호흡", "미토콘드리아", "내막", "전자", "전달계", "화학", "삼투", "글루코스", "ATP"],
        answer: "약 26~28 ATP (전체 세포 호흡 합산 시 약 30~32 ATP)",
        solution: "전자전달계를 거친 NADH와 FADH2가 내막의 ATP 합성효소를 통과하며 고농도의 수소 이온 확산을 일으켜 대량의 ATP를 형성합니다."
      },
      {
        questionText: "DNA 복제 과정에서 지선(Lagging strand)에서 불연속적으로 합성되는 짧은 DNA 조각의 명칭과 이를 연결하는 효소는?",
        keywords: ["DNA", "복제", "지선", "불연속", "합성", "조각", "명칭", "연결", "효소"],
        answer: "오카자키 조각 (Okazaki fragment) / DNA 연결효소 (Ligase)",
        solution: "5'에서 3' 방향으로만 중합이 가능하므로 복제포크 반대 방향은 불연속적인 오카자키 조각이 생기며, 이를 라이게이스가 결합합니다."
      }
    ];

    try {
      for (const prob of biologyDatabase) {
        await addDoc(collection(db, "problems"), prob);
      }
      alert("biology-question-parser: 생물학 데이터 주입 성공!");
    } catch (e) {
      alert("DB 주입 에러: " + e.message);
    }
  };

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <div style={styles.logoGroup}>
          <span style={styles.logoBadge}>BIO</span>
          <h1 style={styles.logoText}>biology-question-parser</h1>
        </div>
        <button onClick={seedDatabase} style={styles.seedBtn}>⚙️ 샘플 데이터 동기화</button>
      </header>

      <main style={styles.mainContent}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>🧬 AI 생물학 문제 분석 엔진</h2>
          <p style={styles.cardSubtitle}>문제를 촬영하거나 스크린샷을 올리면 내부 인공지능 알고리즘이 즉시 풀이를 추적합니다.</p>
          
          <div style={styles.uploadArea}>
            <input type="file" accept="image/*" onChange={handleImageChange} id="file-picker" style={{ display: 'none' }} />
            <label htmlFor="file-picker" style={styles.uploadBtn}>📸 문제 사진 선택하기</label>
          </div>

          {image && (
            <div style={styles.previewContainer}>
              <div style={styles.imgBox}>
                <p style={styles.imgLabel}>원본 입력 이미지</p>
                <img src={image} style={styles.previewImg} alt="Original" />
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {processedImage && (
                <div style={styles.imgBox}>
                  <p style={styles.imgLabel}>⚡ AI 필터링 (고대비 스캔)</p>
                  <img src={processedImage} style={styles.previewImg} alt="Processed" />
                </div>
              )}
            </div>
          )}

          {image && (
            <div style={{ marginTop: '24px' }}>
              <button onClick={handleAiAnalysis} disabled={loading} style={loading ? styles.actionBtnDisabled : styles.actionBtn}>
                {loading ? '알고리즘 연산 실행 중...' : '🔮 원클릭 해설 및 정답 매칭'}
              </button>
            </div>
          )}

          {loading && (
            <div style={styles.statusBanner}>
              <div style={styles.spinner}></div>
              <span style={{ marginLeft: '12px', fontWeight: '500' }}>
                {stepStatus === 'ENGINE_PREPROCESSING' && '🔬 1단계: 그래픽 가속 노이즈 제거 중...'}
                {stepStatus === 'ENGINE_OCR' && `🧬 2단계: 신경망 텍스트 판독 중... (${progress}%)`}
                {stepStatus === 'ENGINE_SEARCH' && '🔍 3단계: 크로스 유사도 매칭 데이터 조회 중...'}
              </span>
            </div>
          )}
        </section>

        {stepStatus === 'SUCCESS' && (
          <section style={{ marginTop: '30px' }}>
            <h3 style={styles.sectionHeading}>🎯 가장 일치하는 분석 결과</h3>
            {searchResults.map((prob, index) => (
              <div key={prob.id} style={index === 0 ? styles.bestMatchCard : styles.matchCard}>
                <div style={styles.matchBadgeRow}>
                  <span style={index === 0 ? styles.bestBadge : styles.normalBadge}>
                    {index === 0 ? `🥇 최적 매칭 ${prob.matchScore}% 일치` : `유사 문항 ${prob.matchScore}%`}
                  </span>
                </div>
                <p style={styles.resultText}><strong>질문 발문:</strong> {prob.questionText}</p>
                <div style={styles.divider}></div>
                <p style={styles.answerText}><strong>🔑 핵심 정답:</strong> {prob.answer}</p>
                <p style={styles.solutionText}><strong>📝 정밀 풀이:</strong> {prob.solution}</p>
              </div>
            ))}
          </section>
        )}

        {stepStatus === 'EMPTY' && (
          <div style={styles.emptyState}>⚠️ 매칭되는 개념 정보가 DB에 없습니다. 다른 각도에서 촬영해 보십시오.</div>
        )}
      </main>
    </div>
  );
}

const styles = {
  appContainer: { minHeight: '100vh', backgroundColor: '#f4f7f6', color: '#1e293b', fontFamily: '"Pretendard", -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 40px', backgroundColor: '#064e3b', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  logoGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoBadge: { backgroundColor: '#10b981', color: '#064e3b', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px' },
  logoText: { fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px', margin: 0 },
  seedBtn: { background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' },
  mainContent: { maxWidth: '850px', margin: '40px auto', padding: '0 20px' },
  card: { backgroundColor: '#fff', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 25px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', textAlign: 'center' },
  cardTitle: { fontSize: '26px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0' },
  cardSubtitle: { fontSize: '15px', color: '#64748b', margin: '0 0 30px 0', lineHeight: '1.5' },
  uploadArea: { display: 'flex', justifyContent: 'center', marginBottom: '24px' },
  uploadBtn: { padding: '14px 32px', backgroundColor: '#10b981', color: '#fff', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' },
  previewContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '30px 0', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px' },
  imgBox: { textAlign: 'left' },
  imgLabel: { fontSize: '12px', fontWeight: '700', color: '#64748b', margin: '0 0 8px 4px' },
  previewImg: { width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '10px', backgroundColor: '#fff', border: '1px solid #e2e8f0' },
  actionBtn: { width: '100%', padding: '16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' },
  actionBtnDisabled: { width: '100%', padding: '16px', backgroundColor: '#cbd5e1', color: '#94a3b8', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'not-allowed' },
  statusBanner: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '20px', padding: '14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534' },
  spinner: { width: '20px', height: '20px', border: '3px solid #bbf7d0', borderTop: '3px solid #166534', borderRadius: '50%', transform: 'rotate(0deg)' },
  sectionHeading: { fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 16px 4px' },
  bestMatchCard: { backgroundColor: '#fff', borderRadius: '18px', padding: '28px', marginBottom: '20px', border: '2px solid #10b981', boxShadow: '0 10px 20px rgba(16,185,129,0.05)' },
  matchCard: { backgroundColor: '#fff', borderRadius: '18px', padding: '28px', marginBottom: '20px', border: '1px solid #e2e8f0', opacity: 0.85 },
  matchBadgeRow: { display: 'flex', marginBottom: '14px' },
  bestBadge: { backgroundColor: '#d1fae5', color: '#065f46', padding: '6px 12px', borderRadius: '30px', fontSize: '13px', fontWeight: '700' },
  normalBadge: { backgroundColor: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '30px', fontSize: '13px', fontWeight: '600' },
  resultText: { fontSize: '16px', color: '#334155', margin: '0 0 16px 0', lineHeight: '1.6' },
  divider: { height: '1px', backgroundColor: '#e2e8f0', margin: '16px 0' },
  answerText: { fontSize: '16px', color: '#b91c1c', fontWeight: '700', margin: '0 0 8px 0' },
  solutionText: { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 },
  emptyState: { textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '16px', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: '500' }
};

export default App;