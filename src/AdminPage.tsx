import React, { useState } from "react";
import {
  Compass,
  Bookmark,
  FolderOpen,
  Folder,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Edit,
  Sliders,
  Sparkles,
  Layers,
  ArrowLeft,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Eye,
  Info,
  Lightbulb,
  FileText,
  Cpu,
  Tv,
  Settings,
} from "lucide-react";
import {
  TopicKeywordForm,
  TopicSloganConfig,
  TopicImageUploader,
  TopicRenameInput,
  AddSecondLevelForm,
  EditSecondLevelForm,
  AddManualTopicForm,
  TopicSummarizerPanel,
  getTopicDisplayName,
  getTopicSelectLabel,
} from "./App";

interface AdminPageProps {
  topicKeywords: Record<string, string[]>;
  setTopicKeywords: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  topicParents: Record<string, string>;
  setTopicParents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  secondLevelKeywords: Array<{
    id: string;
    parentTopic: string;
    keyword: string;
    caption: string;
    imageUrl: string;
  }>;
  setSecondLevelKeywords: React.Dispatch<React.SetStateAction<any[]>>;
  topicKnowledge: Record<string, string>;
  setTopicKnowledge: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  topicConciseSummaries: Record<string, string>;
  setTopicConciseSummaries: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isConfigsLoaded: boolean;
  scannedFolderImages: Record<string, string[]>;
  fetchScannedFolderImages: () => Promise<void>;
  imageVersion: number;
  setImageVersion: React.Dispatch<React.SetStateAction<number>>;
  predictedTopic: string | null;
  addNewTopic: (
    topicName: string,
    keywords: string[],
    initialKnowledge?: string,
    parentTopicName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  learnNewKeywords: (topic: string, newKws: string[]) => void;
  expandAllTopics: () => void;
  collapseAllTopics: () => void;
  resetToDefaultTopics: () => void;
  addSecondLevelKeyword: (parentTopic: string, keyword: string, caption: string, imageUrl: string) => boolean;
  removeSecondLevelKeyword: (id: string) => void;
  updateSecondLevelKeyword: (id: string, parentTopic: string, keyword: string, caption: string, imageUrl: string) => boolean;
  syncNotification: { type: "success" | "error" | "info"; message: string } | null;
  setSyncNotification: (notif: { type: "success" | "error" | "info"; message: string } | null) => void;
  setCurrentPath: (path: "admin" | "test") => void;
  expandedTopics: Record<string, boolean>;
  setExpandedTopics: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  editingTopic: string | null;
  setEditingTopic: (topic: string | null) => void;
  editingSubId: string | null;
  setEditingSubId: (id: string | null) => void;
  activeSubConfigWithDelay: any;
  setActiveSubConfigWithDelay: any;
  setLastValidTopic: (topic: string) => void;
  setPredictedTopic: (topic: string | null) => void;
  clearLearnedKeywordsForTopic: (topic: string) => void;
  deleteCustomTopic: (topic: string) => void;
  getTopicHierarchyPath: (topic: string) => string[];
  removeKeyword: (topic: string, keyword: string) => void;
  renameCustomTopic: (oldName: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  getFlattenedScannedImages: () => string[];
}

export default function AdminPage({
  topicKeywords,
  setTopicKeywords,
  topicParents,
  setTopicParents,
  secondLevelKeywords,
  setSecondLevelKeywords,
  topicKnowledge,
  setTopicKnowledge,
  topicConciseSummaries,
  setTopicConciseSummaries,
  isConfigsLoaded,
  scannedFolderImages,
  fetchScannedFolderImages,
  imageVersion,
  setImageVersion,
  predictedTopic,
  addNewTopic,
  learnNewKeywords,
  expandAllTopics,
  collapseAllTopics,
  resetToDefaultTopics,
  addSecondLevelKeyword,
  removeSecondLevelKeyword,
  updateSecondLevelKeyword,
  syncNotification,
  setSyncNotification,
  setCurrentPath,
  expandedTopics,
  setExpandedTopics,
  editingTopic,
  setEditingTopic,
  editingSubId,
  setEditingSubId,
  activeSubConfigWithDelay,
  setActiveSubConfigWithDelay,
  setLastValidTopic,
  setPredictedTopic,
  clearLearnedKeywordsForTopic,
  deleteCustomTopic,
  getTopicHierarchyPath,
  removeKeyword,
  renameCustomTopic,
  getFlattenedScannedImages,
}: AdminPageProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-rose-500 selection:text-white pb-20">
      {/* Sleek Top Banner Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPath("test")}
              className="p-2 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 text-slate-300 transition duration-200 flex items-center gap-1.5 cursor-pointer font-semibold text-xs"
              title="Quay về giao diện Thử nghiệm"
            >
              <ArrowLeft className="w-4 h-4 text-rose-500" />
              <span>Chế độ Test</span>
            </button>
            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-rose-400 bg-clip-text text-transparent">
                  NhaDat.company
                </span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20 font-bold">
                  BẢNG QUẢN TRỊ CẤU HÌNH
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={resetToDefaultTopics}
              className="text-xs flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-300 rounded-lg border border-slate-800 hover:border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Khôi phục gốc</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-6">
        {/* Top Tip Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-950/90 to-rose-950/10 border border-slate-800 rounded-2xl p-4 flex items-start gap-3 shadow-xl">
          <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">HƯỚNG DẪN QUẢN TRỊ NHẬP LIỆU</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Trang này được thiết kế riêng cho việc quản trị, cập nhật từ khóa và hình ảnh. Việc tách biệt giúp việc nhập liệu cực kỳ mượt mà, không bị lag bởi các luồng phân tích hay hoạt ảnh của giao diện Test.
            </p>
            <p className="text-[11px] text-rose-400 mt-1.5 font-medium flex items-center gap-1">
              <span>💡 Mẹo:</span> Sau khi nhập liệu xong, hãy bấm nút <strong>Chế độ Test (⬅️)</strong> ở góc trên bên trái để kiểm thử trực tiếp!
            </p>
          </div>
        </div>

        {/* BỘ TỰ ĐỘNG TÓM TẮT CHỦ ĐỀ & SLOGAN */}
        <div className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 backdrop-blur shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-slate-900 pb-2">
            <Cpu className="w-3.5 h-3.5 text-rose-500" />
            <span>Tự động tóm tắt & Slogan tư vấn</span>
          </h3>
          <TopicSummarizerPanel
            topicKeywords={topicKeywords}
            topicParents={topicParents}
            topicKnowledge={topicKnowledge}
            setTopicKnowledge={setTopicKnowledge}
            topicConciseSummaries={topicConciseSummaries}
            setTopicConciseSummaries={setTopicConciseSummaries}
            isConfigsLoaded={isConfigsLoaded}
          />
        </div>

        {/* CẤU HÌNH CÂY THƯ MỤC & TỪ KHÓA NHẬN DIỆN */}
        <div className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 backdrop-blur shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
          <div className="flex items-center justify-between gap-2 border-b border-slate-850 pb-2 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 text-rose-500" />
              <span>Cấu hình cây thư mục & từ khóa nhận diện</span>
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={expandAllTopics}
                className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition flex items-center gap-1 normal-case px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 rounded-md"
                title="Mở rộng tất cả các thư mục trong cây thư mục"
              >
                <FolderOpen className="w-2.5 h-2.5" />
                <span>Mở tất cả</span>
              </button>
              <button
                type="button"
                onClick={collapseAllTopics}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-300 transition flex items-center gap-1 normal-case px-2 py-0.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-md"
                title="Thu gọn tất cả các thư mục trong cây thư mục"
              >
                <Folder className="w-2.5 h-2.5" />
                <span>Thu tất cả</span>
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-normal">
            Hệ thống phân loại hội thoại và hiển thị hình ảnh chuẩn xác theo cây thư mục và từ khóa được cấu hình dưới đây:
          </p>

          <AddManualTopicForm
            topicKeywords={topicKeywords}
            topicParents={topicParents}
            addNewTopic={addNewTopic}
            setSyncNotification={(notif) => {
              if (notif) {
                setSyncNotification({ type: notif.type === "info" ? "success" : notif.type, message: notif.message });
              } else {
                setSyncNotification(null);
              }
            }}
          />

          <div className="space-y-3 mt-1">
            {(() => {
              const roots: string[] = [];
              const childrenMap: Record<string, string[]> = {};
              
              Object.keys(topicKeywords).forEach(tn => {
                childrenMap[tn] = [];
              });
              
              Object.keys(topicKeywords).forEach(tn => {
                const parent = topicParents[tn];
                if (parent && topicKeywords[parent]) {
                  childrenMap[parent].push(tn);
                } else {
                  roots.push(tn);
                }
              });

              const renderTopicNode = (topicName: string, depth: number) => {
                const children = childrenMap[topicName] || [];
                const subKeywords = secondLevelKeywords.filter((item) => item.parentTopic === topicName);
                const hasChildren = children.length > 0 || subKeywords.length > 0;
                const isExpanded = expandedTopics[topicName] !== false;
                const isEditing = editingTopic === topicName;
                const keywordsList = topicKeywords[topicName] || [];
                
                const baseCountMap: Record<string, number> = {
                  "Dự án Nyah Phú Định": 10,
                  "Nội thất nhà bếp": 12,
                  "Mẫu nhà Cosmo Gen 2": 18,
                  "Mẫu nhà Fusion Gen 5": 9,
                  "Vị trí dự án Nyah Phú Định": 16,
                  "Tiện ích xung quanh": 20,
                  "Nội thất phòng ngủ": 12,
                  "Nội thất phòng khách": 12,
                  "Nội thất phòng tâm": 12,
                  "Chủ đề khác hoặc dự án khác": 12
                };
                const baseCount = baseCountMap[topicName] || 12;

                return (
                  <div key={topicName} className="flex flex-col gap-1.5">
                    <div 
                      onClick={() => {
                        setLastValidTopic(topicName);
                        setPredictedTopic(topicName);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none group/topic-card ${
                        predictedTopic === topicName 
                          ? "bg-emerald-950/25 border-emerald-500/40 hover:bg-emerald-950/35" 
                          : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850/30"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedTopics(prev => ({
                                ...prev,
                                [topicName]: !isExpanded
                              }));
                            }}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        ) : (
                          <div className="w-5 h-5 flex items-center justify-center text-slate-600 text-xs shrink-0">
                            •
                          </div>
                        )}

                        <span className="text-sm shrink-0">
                          {hasChildren ? (
                            isExpanded ? (
                              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 text-amber-500" />
                            )
                          ) : (
                            <span>
                              {getTopicDisplayName(topicName) === "Dự án Nyah Phú Định" ? "🏢" :
                               getTopicDisplayName(topicName) === "Vị trí dự án Nyah Phú Định" ? "📍" : 
                               getTopicDisplayName(topicName) === "Tiện ích xung quanh" ? "🌳" : 
                               getTopicDisplayName(topicName) === "Mẫu nhà Cosmo Gen 2" ? "🏠" : 
                               getTopicDisplayName(topicName) === "Mẫu nhà Fusion Gen 5" ? "🚗" : 
                               getTopicDisplayName(topicName) === "Nội thất nhà bếp" ? "🍳" : 
                               getTopicDisplayName(topicName) === "Nội thất phòng ngủ" ? "🛏️" : 
                               getTopicDisplayName(topicName) === "Nội thất phòng khách" ? "🛋️" : 
                               getTopicDisplayName(topicName) === "Nội thất phòng tắm" ? "🚿" : "🏷️"}
                            </span>
                          )}
                        </span>

                        <span className="text-[11px] font-bold text-slate-200 truncate flex-1">
                          {getTopicDisplayName(topicName)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {keywordsList.length > baseCount && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearLearnedKeywordsForTopic(topicName);
                            }}
                            className="text-[8px] font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-0.5 px-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded"
                            title={`Xóa nhanh các từ khóa tự học của chủ đề "${topicName}"`}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                        <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.2 rounded font-semibold">
                          {keywordsList.length} từ
                        </span>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTopic(isEditing ? null : topicName);
                          }}
                          className={`p-1 rounded transition ${
                            isEditing 
                              ? "bg-emerald-500/20 text-emerald-400" 
                              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                          }`}
                          title="Cấu hình chi tiết chủ đề"
                        >
                          <Settings className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomTopic(topicName);
                          }}
                          className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition"
                          title={`Xóa chủ đề "${topicName}"`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl ml-4 space-y-2.5">
                        {(() => {
                          const ancestors = getTopicHierarchyPath(topicName);
                          if (ancestors.length > 0) {
                            return (
                              <div className="text-[8px] text-slate-500 flex items-center gap-1 flex-wrap">
                                {ancestors.map((anc) => (
                                  <React.Fragment key={anc}>
                                    <span>{anc}</span>
                                    <span>➔</span>
                                  </React.Fragment>
                                ))}
                                <span className="text-emerald-400 font-semibold">{topicName}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <TopicRenameInput
                          topicName={topicName}
                          renameCustomTopic={renameCustomTopic}
                          setEditingTopic={setEditingTopic}
                          setSyncNotification={setSyncNotification}
                        />

                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Các từ khóa nhận diện:</label>
                          <div className="flex flex-wrap gap-1">
                            {keywordsList.map((kw, i) => {
                              const isNew = i >= baseCount;
                              return (
                                <span 
                                  key={i} 
                                  className={`text-[9px] pl-1.5 pr-0.5 py-0.2 rounded transition duration-300 flex items-center gap-0.5 group/kw-item ${
                                    isNew 
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold" 
                                      : "bg-slate-900 text-slate-400 border border-slate-850"
                                  }`}
                                >
                                  <span>{kw}</span>
                                  {isNew && <span className="text-[8px]">✨</span>}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeKeyword(topicName, kw);
                                    }}
                                    className="w-3 h-3 rounded-full flex items-center justify-center hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 transition-colors ml-0.5"
                                    title={`Xóa từ khóa "${kw}"`}
                                  >
                                    <X className="w-2 h-2" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Chủ đề cha:</span>
                          <select
                            value={topicParents[topicName] || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTopicParents((prev) => {
                                const updated = { ...prev };
                                if (val) {
                                  updated[topicName] = val;
                                } else {
                                  delete updated[topicName];
                                }
                                try {
                                  localStorage.setItem("topic_parents", JSON.stringify(updated));
                                } catch (err) {
                                  console.error(err);
                                }
                                return updated;
                              });
                            }}
                            className="bg-slate-900 border border-slate-850 hover:border-slate-750 text-[10px] text-emerald-400 font-medium px-2 py-1 rounded focus:outline-none focus:border-emerald-500 cursor-pointer flex-1 transition"
                          >
                            <option value="">-- Không có (Chủ đề gốc) --</option>
                            {Object.keys(topicKeywords)
                              .filter((tn) => tn !== topicName)
                              .map((tn) => (
                                <option key={tn} value={tn}>
                                  {tn}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="pt-2 border-t border-slate-900">
                          <TopicKeywordForm topicName={topicName} learnNewKeywords={learnNewKeywords} />
                        </div>

                        <TopicSloganConfig
                          topicName={topicName}
                          topicConciseSummaries={topicConciseSummaries}
                          setTopicConciseSummaries={setTopicConciseSummaries}
                          setSyncNotification={setSyncNotification}
                        />

                        <TopicImageUploader
                          topicName={topicName}
                          topicParents={topicParents}
                          scannedFolderImages={scannedFolderImages}
                          fetchScannedFolderImages={fetchScannedFolderImages}
                          setSyncNotification={setSyncNotification}
                          imageVersion={imageVersion}
                          setImageVersion={setImageVersion}
                        />

                        <div className="pt-2 border-t border-slate-900">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cấu hình từ khóa Lớp 2 (HÌNH ẢNH & PHỤ ĐỀ PHỤ):</span>
                          <AddSecondLevelForm
                            topicKeywords={topicKeywords}
                            topicParents={topicParents}
                            getFlattenedScannedImages={getFlattenedScannedImages}
                            addSecondLevelKeyword={addSecondLevelKeyword}
                            setSyncNotification={setSyncNotification}
                            fixedTopicName={topicName}
                          />
                        </div>
                      </div>
                    )}

                    {hasChildren && isExpanded && (
                      <div className="border-l border-slate-800/60 ml-3.5 pl-3 space-y-2 mt-1">
                        {children.map(childName => renderTopicNode(childName, depth + 1))}
                        
                        {subKeywords.map((item) => {
                          const isSubEditing = editingSubId === item.id;
                          const isSubActive = activeSubConfigWithDelay?.id === item.id;

                          return (
                            <div key={item.id} className="flex flex-col gap-1.5 ml-2">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLastValidTopic(item.parentTopic);
                                  setPredictedTopic(item.parentTopic);
                                  setActiveSubConfigWithDelay(item);
                                }}
                                className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none group/sub-card ${
                                  isSubActive
                                    ? "bg-rose-950/25 border-rose-500/40 hover:bg-rose-950/35"
                                    : "bg-slate-900/20 border-slate-800/60 hover:border-slate-700 hover:bg-slate-850/20"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className="w-3.5 h-3.5 flex items-center justify-center text-rose-500 text-xs shrink-0 font-bold">
                                    ↳
                                  </div>
                                  
                                  {item.imageUrl ? (
                                    <div className="w-5 h-5 rounded overflow-hidden border border-slate-800 shrink-0 bg-slate-950">
                                      <img 
                                        src={item.imageUrl.startsWith("/") ? `${item.imageUrl}?v=${imageVersion}` : item.imageUrl} 
                                        alt={item.keyword}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = "none";
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] shrink-0">🖼️</span>
                                  )}
                                  
                                  <div className="flex-1 min-w-0 flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-slate-300 truncate">
                                        {item.keyword}
                                      </span>
                                      <span className="text-[8px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1 py-0.2 rounded shrink-0">
                                        Lớp 2
                                      </span>
                                    </div>
                                    <p className="text-[8px] text-slate-500 truncate mt-0.5">
                                      {item.caption || "Không có phụ đề phụ"}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSubId(isSubEditing ? null : item.id);
                                    }}
                                    className={`p-1 rounded transition ${
                                      isSubEditing
                                        ? "bg-rose-500/20 text-rose-400"
                                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                                    }`}
                                    title="Sửa cấu hình Lớp 2"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeSecondLevelKeyword(item.id);
                                    }}
                                    className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition"
                                    title="Xóa cấu hình Lớp 2"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {isSubEditing && (
                                <div className="bg-slate-950/70 border border-slate-900 p-2.5 rounded-xl ml-4 text-[9px]">
                                  <EditSecondLevelForm
                                    item={item}
                                    topicKeywords={topicKeywords}
                                    topicParents={topicParents}
                                    getFlattenedScannedImages={getFlattenedScannedImages}
                                    updateSecondLevelKeyword={updateSecondLevelKeyword}
                                    setEditingSubId={setEditingSubId}
                                    setSyncNotification={setSyncNotification}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              };

              return roots.map(rootName => renderTopicNode(rootName, 0));
            })()}
          </div>
        </div>

        {/* CẤU HÌNH TỪ KHÓA LỚP 2 TỔNG HỢP */}
        <div className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 backdrop-blur shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-slate-850 pb-2">
            <Layers className="w-3.5 h-3.5 text-rose-500" />
            <span>Từ khóa Lớp 2 & Hình ảnh/Phụ đề phụ</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {secondLevelKeywords.length === 0 ? (
              <div className="md:col-span-2 py-8 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center gap-1.5 text-slate-500 text-center">
                <Layers className="w-8 h-8 text-slate-700" />
                <p className="text-[11px] font-semibold">Chưa có ánh xạ Từ khóa Lớp 2 nào</p>
                <p className="text-[9px] text-slate-600 max-w-xs mt-0.5">
                  Thêm từ khóa phụ ở form bên dưới hoặc nút cấu hình ở từng chủ đề trên cây thư mục.
                </p>
              </div>
            ) : (
              secondLevelKeywords.map((item) => {
                return (
                  <div 
                    key={item.id}
                    className="p-3 bg-slate-900/35 border border-slate-800/80 rounded-xl flex gap-3 hover:border-slate-700 transition"
                  >
                    {item.imageUrl && (
                      <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-800 shrink-0 bg-slate-950 group/thumb relative">
                        <img 
                          src={item.imageUrl.startsWith("/") ? `${item.imageUrl}?v=${imageVersion}` : item.imageUrl} 
                          alt={item.keyword}
                          className="w-full h-full object-cover transition duration-350 group-hover/thumb:scale-110"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="bg-slate-800 text-slate-300 text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                          Chủ đề: {item.parentTopic}
                        </span>
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                          Từ khóa: {item.keyword}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                        {item.caption}
                      </p>
                      {item.imageUrl && (
                        <span className="text-[8px] text-slate-500 font-mono truncate max-w-full">
                          Ảnh: {item.imageUrl}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubId(item.id);
                        }}
                        className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSecondLevelKeyword(item.id)}
                        className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-2.5 pt-3.5 border-t border-slate-900">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thêm ánh xạ Lớp 2 mới:</h4>
            <AddSecondLevelForm
              topicKeywords={topicKeywords}
              topicParents={topicParents}
              getFlattenedScannedImages={getFlattenedScannedImages}
              addSecondLevelKeyword={addSecondLevelKeyword}
              setSyncNotification={setSyncNotification}
            />
          </div>
        </div>
      </main>

      {/* Floating Dynamic Sync Notification */}
      {syncNotification && (
        <div className="fixed bottom-6 right-6 z-[101] max-w-sm w-[350px] bg-slate-950/95 border border-emerald-500/60 rounded-2xl p-4 shadow-2xl shadow-emerald-950/30 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex gap-3 items-center">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center justify-center h-10 w-10">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  🔄 Đồng bộ hoàn tất
                </span>
                <button 
                  onClick={() => setSyncNotification(null)}
                  className="text-slate-500 hover:text-slate-300 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-200 mt-1 leading-snug">
                {syncNotification.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
