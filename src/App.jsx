import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

// ⚠️ 여기에 팀장님의 Firebase 웹 앱 설정값(콘솔에서 복사한 것)을 붙여넣으세요!
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
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('');

  // 무료 텍스트 정제 알고리즘
  const tokenizeText = (rawText) => {
    return rawText
      .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)
      .slice(0, 10);
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(URL.createObjectURL(e.target.files[0]));
      setText('');
      setSearchResults([]);
      setSearchStatus('');
    }
  };

  const handleExtractAndSearch = () => {
    if (!image) return alert('사진을 업로드해 주세요.');
    setLoading(true);
    setSearchStatus('이미지에서 글자를 읽는 중...');

    Tesseract.recognize(image, 'kor+eng', {
      logger: m => m.status === 'recognizing text' && setProgress(Math.round(m.progress * 100))
    })
    .then(({ data: { text } }) => {
      setText(text);
      executeSearch(text);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
      alert('OCR 인식 실패');
    });
  };

  const executeSearch = async (extractedText) => {
    setSearchStatus('데이터베이스에서 유사 문제를 검색 중...');
    const keywords = tokenizeText(extractedText);

    if (keywords.length === 0) {
      setSearchResults([]);
      setSearchStatus('인식된 핵심 키워드가 없습니다.');
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, "problems"), where("keywords", "array-contains-any", keywords));
      const querySnapshot = await getDocs(q);
      
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });

      setSearchResults(results);
      setSearchStatus(results.length > 0 ? `성공: ${results.length}개의 문제를 찾았습니다.` : '일치하는 문제가 DB에 없습니다.');
    } catch (error) {
      console.error(error);
      setSearchStatus('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // [biology-question-parser] 생물학 맞춤형 데이터 주입 시스템
  const seedDatabase = async () => {
    const biologyProblems = [
      {
        questionText: "미토콘드리아의 주요 기능은 세포 호흡을 통해 ATP를 생산하는 것이다. 이 설명이 맞는지 서술하시오.",
        keywords: ["미토콘드리아", "세포호흡", "ATP", "생산", "세포"],
        answer: "O (맞음)",
        solution: "미토콘드리아는 세포 내 유기물을 분해하여 생명 활동에 필요한 에너지 형태인 ATP를 합성하는 세포 소기관입니다."
      },
      {
        questionText: "멘델의 유전 법칙 중 잡종 1대에서 대립 형질 중 한 가지만 발현되는 법칙은 무엇인가?",
        keywords: ["멘델", "유전법칙", "잡종", "대립형질", "발현"],
        answer: "우열의 원리 (또는 우열의 법칙)",
        solution: "순종의 대립 형질을 교배했을 때 잡종 1대에서 우성 형질만 겉으로 드러나는 현상을 우열의 원리라고 합니다."
      },
      {
        questionText: "식물의 광합성 과정에서 명반응이 일어나는 세포 소기관 내의 구체적인 장소는 어디인가?",
        keywords: ["광합성", "명반응", "세포소기관", "장소는", "틸라코이드"],
        answer: "엽록체의 틸라코이드 막",
        solution: "광합성의 명반응은 엽록체의 틸라코이드 막에서 빛에너지를 흡수하여 물을 분해하고 ATP와 NADPH를 생성하는 과정입니다."
      }
    ];

    try {
      for (const prob of biologyProblems) {
        await addDoc(collection(db, "problems"), prob);
      }
      alert("biology-question-parser: 생물학 문제 은행 데이터 주입 성공!");
    } catch (e) {
      alert("데이터 주입 실패: " + e.message);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>🎯 콴다 클론: AI 통합 검색기</h2>
      
      <div style={{ textAlign: 'right' }}>
        <button onClick={seedDatabase} style={{ fontSize: '11px', background: '#e0e0e0', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
          ⚙️ 최초 1회 샘플 DB 주입
        </button>
      </div>

      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <input type="file" accept="image/*" onChange={handleImageChange} id="file" style={{ display: 'none' }} />
        <label htmlFor="file" style={{ padding: '10px 20px', background: '#007bff', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          문제 사진 선택
        </label>
      </div>

      {image && (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <img src={image} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px' }} alt="preview" />
          <div style={{ marginTop: '15px' }}>
            <button onClick={handleExtractAndSearch} disabled={loading} style={{ padding: '12px 24px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? `처리 중... (${progress}%)` : '🔍 원클릭 정답 검색'}
            </button>
          </div>
        </div>
      )}

      {searchStatus && <p style={{ textAlign: 'center', fontWeight: 'bold', color: '#555' }}>{searchStatus}</p>}

      {searchResults.length > 0 && (
        <div style={{ marginTop: '35px' }}>
          <h3>📋 검색된 매칭 문제</h3>
          {searchResults.map((prob) => (
            <div key={prob.id} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e9ecef' }}>
              <p><strong>📄 원본 문제:</strong> {prob.questionText}</p>
              <p style={{ color: '#dc3545' }}><strong>💡 정답:</strong> {prob.answer}</p>
              <p style={{ color: '#6c757d', fontSize: '14px' }}><strong>📝 풀이:</strong> {prob.solution}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;