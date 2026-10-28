export interface DownloadStream {
  id?: string;
  type: 'video' | 'audio' | 'image' | 'file' | 'link' | 'subtitle';
  quality: string;
  ext?: string;
  url: string;
  filesize?: number | null;
  filesizeFormatted?: string;
  vcodec?: string | null;
  acodec?: string | null;
  fps?: number | null;
  tbr?: number | null;
  resolution?: string | null;
  needsResolve?: boolean;
}

export interface MediaMetadata {
  title: string;
  author: string;
  authorUrl?: string;
  platform: string;
  extractorKey?: string;
  engine: string;
  serverUsed?: string;
  webpageUrl: string;
  thumbnail: string;
  duration?: string;
  durationSeconds?: number;
  uploadDate?: string;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  description?: string;
  resolution?: string;
  fps?: number | null;
  vcodec?: string;
  acodec?: string;
  filesizeApprox?: string;
  tags?: string[];
  categories?: string[];
  downloads: DownloadStream[];
  images?: string[];
}

export interface HistoryItem {
  id: string;
  deviceId: string;
  ipAddress: string;
  url: string;
  title: string;
  author: string;
  platform: string;
  engine: string;
  thumbnail: string;
  duration: string;
  quality: string;
  createdAt: number;
  metadata?: MediaMetadata;
}

export interface SupportedSiteItem {
  name: string;
  description: string;
  category: string;
}
