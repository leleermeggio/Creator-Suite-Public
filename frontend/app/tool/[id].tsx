import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  useWindowDimensions,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { ComingSoonTool } from '@/components/ComingSoonTool';
import { ImageGeneratorUI } from '@/components/ImageGeneratorUI';
import { ThumbnailGeneratorUI } from '@/components/ThumbnailGeneratorUI';
import { TOOLS } from '@/constants/tools';
import { useSettings } from '@/hooks/useSettings';
import { useProject } from '@/hooks/useProject';
import { translateText, LANGUAGES } from '@/services/translate';
import { summarizeText, ocrImage } from '@/services/gemini';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';

const TOOL_HINTS: Record<string, { placeholder: string; inputType: 'text' | 'file' | 'url' | 'image'; features: string[] }> = {
  transcribe: { placeholder: 'Invia un file audio o video...', inputType: 'file', features: ['Whisper AI', 'Multi-lingua', 'Alta precisione', 'Formato SRT'] },
  translate: { placeholder: 'Scrivi il testo da tradurre...', inputType: 'text', features: ['100+ lingue', 'Rilevamento auto', 'Testi lunghi', 'Veloce'] },
  download: { placeholder: 'Incolla URL del video o audio...', inputType: 'url', features: ['YouTube', 'Instagram', 'MP3 / MP4', 'Alta qualità'] },
  summarize: { placeholder: 'Incolla il testo da riassumere...', inputType: 'text', features: ['Gemini AI', 'Bullet points', 'Personalizzabile', 'Multi-formato'] },
  ocr: { placeholder: 'Seleziona un\'immagine con testo...', inputType: 'image', features: ['Multi-lingua', 'PDF support', 'Handwriting', 'Alta precisione'] },
  tts: { placeholder: 'Scrivi il testo da convertire in audio...', inputType: 'text', features: ['Voci naturali', 'Multi-lingua', 'Edge TTS', 'Download MP3'] },
  convert: { placeholder: 'Invia il file da convertire...', inputType: 'file', features: ['Audio → Audio', 'Video → Video', 'FFmpeg', '20+ formati'] },
  jumpcut: { placeholder: 'Invia un video con silenzi...', inputType: 'file', features: ['Auto-detect', 'Threshold config', 'Preview', 'Export'] },
  'ai-image': { placeholder: '', inputType: 'text', features: ['Pollinations AI', 'Gratuito', 'Thumbnail', 'Social covers'] },
};

export default function ToolScreen() {
  const { id, projectId, phaseId } = useLocalSearchParams<{ id: string; projectId?: string; phaseId?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const { settings } = useSettings();
  const { project, addFileToPhase } = useProject(projectId);

  const [inputText, setInputText] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [ttsLang, setTtsLang] = useState('it');
  const [showTtsLangPicker, setShowTtsLangPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jumpcutResult, setJumpcutResult] = useState<{ url: string; filename: string; stats: any } | null>(null);
  const [jumpcutMode, setJumpcutMode] = useState<'file' | 'url'>('file');
  const [jumpcutUrl, setJumpcutUrl] = useState('');
  const [processingPhase, setProcessingPhase] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [convertFormat, setConvertFormat] = useState('mp3');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadType, setDownloadType] = useState<'video' | 'audio'>('video');
  const [whisperModel, setWhisperModel] = useState('small');

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (jumpcutResult?.url && Platform.OS === 'web') {
        URL.revokeObjectURL(jumpcutResult.url);
      }
    };
  }, [jumpcutResult]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (projectId) {
      router.replace(`/project/${projectId}`);
    } else {
      router.replace('/(tabs)');
    }
  };

  const tool = TOOLS.find(t => t.id === id);
  const hints = TOOL_HINTS[id ?? ''];
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 720 : undefined;
  const horizontalPad = isDesktop ? 48 : 20;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  if (!tool || !hints) {
    return <View style={styles.container}><Text style={{ color: COLORS.textPrimary }}>Tool non trovato</Text></View>;
  }

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setImagePreview(dataUrl);
          setImageBase64(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    try {
      const ImagePicker = await import('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
      if (res.canceled) return;
      const asset = res.assets[0];
      setImagePreview(asset.uri);
      setImageBase64(asset.base64 ?? null);
    } catch {
      Alert.alert('Errore', 'Impossibile aprire la galleria.');
    }
  };

  const handlePickFile = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*,audio/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) setSelectedFile(file);
      };
      input.click();
    }
  };

  const getProviderApiKey = () => {
    const p = settings.aiProvider;
    if (p === 'gemini') return settings.googleApiKey;
    if (p === 'groq') return settings.groqApiKey;
    if (p === 'openrouter') return settings.openrouterApiKey;
    return '';
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    setResult(null);
    setJumpcutResult(null);
    setError(null);
    try {
      let output = '';
      const provider = settings.aiProvider;
      const apiKey = getProviderApiKey();
      const model = settings.aiModel;

      if (id === 'translate') {
        if (!inputText.trim()) throw new Error('Inserisci il testo da tradurre.');
        output = await translateText(inputText, targetLang, provider, apiKey, model);
      } else if (id === 'summarize') {
        if (!inputText.trim()) throw new Error('Inserisci il testo da riassumere.');
        output = await summarizeText(provider, apiKey, model, inputText);
      } else if (id === 'ocr') {
        if (!imageBase64) throw new Error("Seleziona un'immagine.");
        output = await ocrImage(provider, apiKey, model, imageBase64);
      } else if (id === 'transcribe') {
        if (!selectedFile) throw new Error('Seleziona un file audio o video.');
        const { API_BASE } = await import('@/services/apiClient');
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        const token = await AsyncStorage.default.getItem('auth_access_token');
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        setProcessingPhase('uploading');
        const res = await fetch(`${API_BASE}/tools/transcribe?model=${whisperModel}&language=${targetLang || ''}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        setProcessingPhase('processing');
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || 'Errore durante la trascrizione');
        }
        
        const data = await res.json();
        output = data.text || '';
      } else if (id === 'tts') {
        if (!inputText.trim()) throw new Error('Inserisci il testo da convertire in audio.');
        const { API_BASE } = await import('@/services/apiClient');
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        const token = await AsyncStorage.default.getItem('auth_access_token');
        
        const res = await fetch(`${API_BASE}/audio/tts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...(projectId ? { project_id: projectId } : {}),
            text: inputText,
            language: ttsLang,
          }),
        });
        
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || 'Errore durante la generazione audio');
        }
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const filename = `tts-${Date.now()}.mp3`;
        setJumpcutResult({ url, filename, stats: {} });
        return;
      } else if (id === 'convert') {
        if (!selectedFile) throw new Error('Seleziona un file da convertire.');
        const { API_BASE } = await import('@/services/apiClient');
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        const token = await AsyncStorage.default.getItem('auth_access_token');
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        setProcessingPhase('uploading');
        const res = await fetch(`${API_BASE}/tools/convert?target_format=${convertFormat}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        setProcessingPhase('processing');
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || 'Errore durante la conversione');
        }
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const filename = res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] || `converted.${convertFormat}`;
        setJumpcutResult({ url, filename, stats: { format: convertFormat } });
        return;
      } else if (id === 'download') {
        if (!downloadUrl.trim()) throw new Error('Inserisci un URL valido.');
        const { API_BASE } = await import('@/services/apiClient');
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        const token = await AsyncStorage.default.getItem('auth_access_token');
        
        setProcessingPhase('processing');
        const res = await fetch(`${API_BASE}/tools/download?url=${encodeURIComponent(downloadUrl)}&format_type=${downloadType}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || 'Errore durante il download');
        }
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const filename = res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] || 'download.mp4';
        const stats = {
          title: res.headers.get('X-Title'),
          duration: res.headers.get('X-Duration'),
          uploader: res.headers.get('X-Uploader'),
        };
        setJumpcutResult({ url, filename, stats });
        return;
      } else if (id === 'jumpcut') {
        if (jumpcutMode === 'file' && !selectedFile) {
          throw new Error('Seleziona un file video o audio.');
        }
        if (jumpcutMode === 'url' && !jumpcutUrl.trim()) {
          throw new Error('Inserisci un URL valido.');
        }
        const { API_BASE } = await import('@/services/apiClient');
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        const token = await AsyncStorage.default.getItem('auth_access_token');
        
        let fetchUrl = `${API_BASE}/tools/jumpcut`;
        const formData = new FormData();
        
        if (jumpcutMode === 'url') {
          fetchUrl += `?url=${encodeURIComponent(jumpcutUrl)}`;
          setProcessingPhase('processing');
        } else {
          formData.append('file', selectedFile!);
          setProcessingPhase('uploading');
        }
        
        const res = await fetch(fetchUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: jumpcutMode === 'file' ? formData : undefined,
        });
        
        setProcessingPhase('processing');
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || 'Errore durante il jumpcut');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const filename = res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] || 'jumpcut.mp4';
        const stats = {
          original: res.headers.get('X-Original-Duration'),
          final: res.headers.get('X-Final-Duration'),
          removed: res.headers.get('X-Removed-Pct'),
          segments: res.headers.get('X-Segments-Count'),
        };
        setJumpcutResult({ url, filename, stats });
        return;
      }
      setResult(output);
    } catch (e: any) {
      setError(e?.message || "Errore durante l'elaborazione.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyResult = () => {
    if (!result) return;
    if (Platform.OS === 'web') navigator.clipboard?.writeText(result).catch(() => {});
  };

  const handleSaveResult = async () => {
    if (!result || !projectId || !phaseId) return;
    try {
      const filename = `${id}-result-${Date.now()}.txt`;
      let uri = '';
      if (Platform.OS === 'web') {
        const blob = new Blob([result], { type: 'text/plain' });
        uri = URL.createObjectURL(blob);
        await addFileToPhase(phaseId, uri, filename, 'text/plain', blob.size, 'tool-output', id);
      } else {
        // On native, write to cache via FileSystem
        const FileSystem = await import('expo-file-system');
        const cacheDir = (FileSystem as any).cacheDirectory ?? '';
        uri = cacheDir + filename;
        await (FileSystem as any).writeAsStringAsync(uri, result);
        await addFileToPhase(phaseId, uri, filename, 'text/plain', result.length, 'tool-output', id);
      }
      const msg = 'Risultato salvato nella fase!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Salvato', msg);
    } catch {
      const msg = 'Errore nel salvataggio.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Errore', msg);
    }
  };

  const handleSaveImage = async (uri: string, filename: string) => {
    if (!projectId || !phaseId) {
      const msg = 'Apri un progetto per salvare immagini nelle fasi.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Info', msg);
      return;
    }
    try {
      await addFileToPhase(phaseId, uri, filename, 'image/jpeg', 0, 'tool-output', 'ai-image');
      const msg = 'Immagine salvata nella fase!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Salvato', msg);
    } catch {
      const msg = 'Errore nel salvataggio.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Errore', msg);
    }
  };

  // AI Image: full custom UI
  if (id === 'ai-image') {
    return (
      <View style={styles.container}>
        <CosmicBackground />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPad, maxWidth: contentMaxWidth, alignSelf: isDesktop ? 'center' : undefined, width: isDesktop ? '100%' : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={styles.backArrow}>←</Text>
              <Text style={styles.backText}>{projectId ? 'Progetto' : 'Menu'}</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.toolHeader, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <LinearGradient colors={tool.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconLarge}>
              <Text style={styles.iconEmoji}>{tool.icon}</Text>
            </LinearGradient>
            <GradientText gradient={tool.gradient} style={TYPO.h1}>{tool.name}</GradientText>
            <Text style={styles.toolDescription}>{tool.description}</Text>
          </Animated.View>
          <ThumbnailGeneratorUI projectId={projectId} onSave={handleSaveImage} />
        </ScrollView>
      </View>
    );
  }

  // Unavailable tools
  if (!tool.available) {
    return (
      <View style={styles.container}>
        <CosmicBackground />
        <Pressable onPress={handleBack} style={[styles.backBtn, { margin: SPACING.lg, marginTop: Platform.select({ web: 40, default: 60 }) }]}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>{projectId ? 'Progetto' : 'Menu'}</Text>
        </Pressable>
        <ComingSoonTool icon={tool.icon} name={tool.name} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CosmicBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPad, maxWidth: contentMaxWidth, alignSelf: isDesktop ? 'center' : undefined, width: isDesktop ? '100%' : undefined }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>{projectId ? 'Progetto' : 'Menu'}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.toolHeader, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={tool.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconLarge}>
            <Text style={styles.iconEmoji}>{tool.icon}</Text>
          </LinearGradient>
          <GradientText gradient={tool.gradient} style={TYPO.h1}>{tool.name}</GradientText>
          <Text style={styles.toolDescription}>{tool.description}</Text>
        </Animated.View>

        <Animated.View style={[styles.featureRow, { opacity: fadeAnim }]}>
          {hints.features.map((f, i) => (
            <View key={i} style={[styles.featurePill, { borderColor: tool.accentColor + '33' }]}>
              <Text style={[styles.featureText, { color: tool.accentColor }]}>{f}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Language picker for TTS */}
        {id === 'tts' && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: SPACING.lg }}>
            <Text style={styles.fieldLabel}>LINGUA VOCE</Text>
            <Pressable onPress={() => setShowTtsLangPicker(!showTtsLangPicker)} style={styles.langSelector}>
              <Text style={styles.langSelectorText}>{LANGUAGES[ttsLang] || ttsLang}</Text>
              <Text style={styles.langSelectorArrow}>{showTtsLangPicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showTtsLangPicker && (
              <ScrollView style={styles.langDropdown} nestedScrollEnabled>
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <Pressable
                    key={code}
                    onPress={() => { setTtsLang(code); setShowTtsLangPicker(false); }}
                    style={[styles.langOption, ttsLang === code && styles.langOptionSelected]}
                  >
                    <Text style={[styles.langOptionText, ttsLang === code && { color: COLORS.neonCyan }]}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* Language picker for translate */}
        {id === 'translate' && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: SPACING.lg }}>
            <Text style={styles.fieldLabel}>TRADUCI IN</Text>
            <Pressable onPress={() => setShowLangPicker(!showLangPicker)} style={styles.langSelector}>
              <Text style={styles.langSelectorText}>{LANGUAGES[targetLang] || targetLang}</Text>
              <Text style={styles.langSelectorArrow}>{showLangPicker ? '▲' : '▼'}</Text>
            </Pressable>
            {showLangPicker && (
              <ScrollView style={styles.langDropdown} nestedScrollEnabled>
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <Pressable
                    key={code}
                    onPress={() => { setTargetLang(code); setShowLangPicker(false); }}
                    style={[styles.langOption, targetLang === code && styles.langOptionSelected]}
                  >
                    <Text style={[styles.langOptionText, targetLang === code && { color: COLORS.neonCyan }]}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {id === 'transcribe' && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: SPACING.lg }}>
            <Text style={styles.fieldLabel}>MODELLO WHISPER</Text>
            <View style={styles.modeToggle}>
              {['tiny', 'small', 'medium'].map((mdl) => (
                <Pressable
                  key={mdl}
                  onPress={() => setWhisperModel(mdl)}
                  style={[styles.modeBtn, whisperModel === mdl && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeBtnText, whisperModel === mdl && styles.modeBtnTextActive]}>
                    {mdl.charAt(0).toUpperCase() + mdl.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {id === 'download' && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: SPACING.lg }}>
            <Text style={styles.fieldLabel}>TIPO DI DOWNLOAD</Text>
            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => setDownloadType('video')}
                style={[styles.modeBtn, downloadType === 'video' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, downloadType === 'video' && styles.modeBtnTextActive]}>🎬 Video</Text>
              </Pressable>
              <Pressable
                onPress={() => setDownloadType('audio')}
                style={[styles.modeBtn, downloadType === 'audio' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, downloadType === 'audio' && styles.modeBtnTextActive]}>🎵 Audio</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {id === 'convert' && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: SPACING.lg }}>
            <Text style={styles.fieldLabel}>FORMATO DI DESTINAZIONE</Text>
            <View style={styles.modeToggle}>
              {['mp3', 'wav', 'mp4', 'webm'].map((fmt) => (
                <Pressable
                  key={fmt}
                  onPress={() => setConvertFormat(fmt)}
                  style={[styles.modeBtn, convertFormat === fmt && styles.modeBtnActive]}
                >
                  <Text style={[styles.modeBtnText, convertFormat === fmt && styles.modeBtnTextActive]}>
                    {fmt.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {id === 'jumpcut' && (
          <Animated.View style={{ opacity: fadeAnim, marginBottom: SPACING.lg }}>
            <Text style={styles.fieldLabel}>MODALITÀ</Text>
            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => setJumpcutMode('file')}
                style={[styles.modeBtn, jumpcutMode === 'file' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, jumpcutMode === 'file' && styles.modeBtnTextActive]}>📁 File</Text>
              </Pressable>
              <Pressable
                onPress={() => setJumpcutMode('url')}
                style={[styles.modeBtn, jumpcutMode === 'url' && styles.modeBtnActive]}
              >
                <Text style={[styles.modeBtnText, jumpcutMode === 'url' && styles.modeBtnTextActive]}>🔗 URL</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        <Animated.View style={{ opacity: fadeAnim }}>
          <GlowCard gradient={tool.gradient} glowIntensity={0.2}>
            {hints.inputType === 'image' ? (
              <Pressable onPress={handlePickImage} style={styles.fileDropZone}>
                {imagePreview ? (
                  <Image source={{ uri: imagePreview }} style={styles.imagePreviewImg} resizeMode="contain" />
                ) : (
                  <View style={styles.fileDropContent}>
                    <Text style={styles.fileDropIcon}>🖼️</Text>
                    <Text style={styles.fileDropText}>{hints.placeholder}</Text>
                    <Text style={styles.fileDropHint}>Tocca per selezionare</Text>
                  </View>
                )}
              </Pressable>
            ) : hints.inputType === 'url' && id === 'download' ? (
              <TextInput
                style={styles.textInput}
                placeholder={hints.placeholder}
                placeholderTextColor={COLORS.textMuted}
                value={downloadUrl}
                onChangeText={setDownloadUrl}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={false}
              />
            ) : hints.inputType === 'file' && id === 'jumpcut' && jumpcutMode === 'url' ? (
              <View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Incolla URL diretto al file video..."
                  placeholderTextColor={COLORS.textMuted}
                  value={jumpcutUrl}
                  onChangeText={setJumpcutUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={false}
                />
                <Text style={styles.urlHint}>
                  💡 Usa link diretti al file (es. Dropbox con dl=1, Google Drive export=download). SwissTransfer/WeTransfer richiedono download manuale → usa modalità File.
                </Text>
              </View>
            ) : hints.inputType === 'file' ? (
              <Pressable onPress={handlePickFile} style={styles.fileDropZone}>
                {selectedFile ? (
                  <View style={styles.fileDropContent}>
                    <Text style={styles.fileDropIcon}>📁</Text>
                    <Text style={styles.fileDropText}>{selectedFile.name}</Text>
                    <Text style={styles.fileDropHint}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</Text>
                  </View>
                ) : (
                  <View style={styles.fileDropContent}>
                    <Text style={styles.fileDropIcon}>📤</Text>
                    <Text style={styles.fileDropText}>{hints.placeholder}</Text>
                    <Text style={styles.fileDropHint}>Tocca per selezionare</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder={hints.placeholder}
                placeholderTextColor={COLORS.textMuted}
                multiline
                value={inputText}
                onChangeText={setInputText}
                numberOfLines={5}
              />
            )}
          </GlowCard>
        </Animated.View>

        <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
          <Pressable
            onPress={handleProcess}
            disabled={isProcessing}
            style={({ pressed }) => [{ opacity: pressed || isProcessing ? 0.7 : 1 }]}
          >
            <LinearGradient colors={tool.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.processBtn}>
              {isProcessing
                ? <ActivityIndicator color={COLORS.bg} />
                : <Text style={styles.processBtnText}>▶ Avvia {tool.name}</Text>
              }
            </LinearGradient>
          </Pressable>
          {isProcessing && id === 'jumpcut' && (
            <View style={styles.progressContainer}>
              {processingPhase === 'uploading' && (
                <Text style={styles.processingHint}>📤 Caricamento file in corso...</Text>
              )}
              {processingPhase === 'processing' && (
                <Text style={styles.processingHint}>✂️ Rimozione silenzi in corso...</Text>
              )}
            </View>
          )}
          {isProcessing && id !== 'jumpcut' && (
            <Text style={styles.processingHint}>✨ Elaborazione in corso...</Text>
          )}
        </Animated.View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RISULTATO</Text>
              <View style={styles.sectionLine} />
            </View>
            <GlowCard gradient={tool.gradient} glowIntensity={0.12}>
              <Text style={styles.resultText} selectable>{result}</Text>
            </GlowCard>
            <View style={styles.resultActions}>
              <Pressable onPress={handleCopyResult} style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>📋 Copia</Text>
              </Pressable>
              {projectId && phaseId && (
                <Pressable onPress={handleSaveResult} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}>
                  <LinearGradient colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveResultBtn}>
                    <Text style={styles.saveResultBtnText}>💾 Salva in fase</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {jumpcutResult && (
          <View style={styles.resultSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RISULTATO</Text>
              <View style={styles.sectionLine} />
            </View>
            <GlowCard gradient={tool.gradient} glowIntensity={0.12}>
              {id === 'tts' ? (
                <Text style={styles.resultText}>✅ Audio generato!</Text>
              ) : id === 'convert' ? (
                <Text style={styles.resultText}>✅ Conversione completata!</Text>
              ) : id === 'download' ? (
                <Text style={styles.resultText}>✅ Download completato!</Text>
              ) : (
                <Text style={styles.resultText}>✅ Video processato!</Text>
              )}
              {jumpcutResult.stats.original && (
                <Text style={[styles.resultText, { fontSize: 13, marginTop: 8 }]}>
                  Durata originale: {jumpcutResult.stats.original}s{' '}→ {jumpcutResult.stats.final}s{' '}({jumpcutResult.stats.removed}% rimosso)
                </Text>
              )}
              {/* Audio player for TTS and audio conversions */}
              {Platform.OS === 'web' && (id === 'tts' || jumpcutResult.filename.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) && (
                React.createElement('audio', {
                  controls: true,
                  src: jumpcutResult.url,
                  style: { width: '100%', marginTop: 12, borderRadius: 8, accentColor: '#E040FB', display: 'block' },
                })
              )}
            </GlowCard>
            <Pressable onPress={() => {
              if (Platform.OS === 'web') {
                const a = document.createElement('a');
                a.href = jumpcutResult.url;
                a.download = jumpcutResult.filename;
                a.click();
              }
            }} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
              <LinearGradient colors={tool.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.processBtn}>
                <Text style={styles.processBtnText}>
                  {id === 'tts' ? '⬇️ Scarica MP3' : id === 'convert' ? '⬇️ Scarica file' : id === 'download' ? '⬇️ Scarica' : '⬇️ Scarica video'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { paddingTop: Platform.select({ web: 40, default: 60 }), paddingBottom: 60 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xl, alignSelf: 'flex-start', paddingVertical: SPACING.sm, paddingRight: SPACING.md },
  backArrow: { fontFamily: FONTS.displayBold, fontSize: 20, color: COLORS.textSecondary },
  backText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textSecondary },
  toolHeader: { marginBottom: SPACING.xl, gap: SPACING.md },
  iconLarge: { width: 72, height: 72, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  iconEmoji: { fontSize: 36 },
  toolDescription: { ...TYPO.body, color: COLORS.textSecondary },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  featurePill: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  featureText: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.3 },
  fieldLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: SPACING.sm },
  modeToggle: { flexDirection: 'row', gap: SPACING.sm },
  modeBtn: { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: COLORS.bgCard, alignItems: 'center' },
  modeBtnActive: { borderColor: COLORS.neonPink, backgroundColor: COLORS.neonPink + '15' },
  modeBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textSecondary },
  modeBtnTextActive: { color: COLORS.neonPink, fontFamily: FONTS.bodySemiBold },
  langSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: COLORS.bgCard },
  langSelectorText: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.textPrimary },
  langSelectorArrow: { fontSize: 12, color: COLORS.textMuted },
  langDropdown: { maxHeight: 200, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.bgElevated, marginTop: SPACING.xs },
  langOption: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  langOptionSelected: { backgroundColor: COLORS.neonCyan + '15' },
  langOptionText: { fontFamily: FONTS.bodyRegular, fontSize: 14, color: COLORS.textPrimary },
  textInput: { fontFamily: FONTS.bodyRegular, fontSize: 15, color: COLORS.textPrimary, minHeight: 120, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}) },
  urlHint: { fontFamily: FONTS.bodyRegular, fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 18 },
  fileDropZone: { minHeight: 160 },
  fileDropContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl, gap: SPACING.md },
  fileDropIcon: { fontSize: 42 },
  fileDropText: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.textPrimary, textAlign: 'center' },
  fileDropHint: { fontFamily: FONTS.bodyRegular, fontSize: 12, color: COLORS.textMuted },
  imagePreviewImg: { width: '100%', height: 200, borderRadius: RADIUS.md },
  buttonContainer: { marginTop: SPACING.xl },
  processBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  progressContainer: { marginTop: SPACING.sm },
  processBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 16, color: COLORS.bg },
  processingHint: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm },
  errorBox: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.neonPink + '15', borderWidth: 1, borderColor: COLORS.neonPink + '44' },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.neonPink },
  audioPlayerContainer: { marginTop: 4, width: '100%' },
  resultSection: { marginTop: SPACING.xxl, gap: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  sectionTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  resultText: { fontFamily: FONTS.bodyRegular, fontSize: 15, color: COLORS.textPrimary, lineHeight: 24 },
  resultActions: { flexDirection: 'row', gap: SPACING.sm },
  copyBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  copyBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textSecondary },
  saveResultBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  saveResultBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
});
