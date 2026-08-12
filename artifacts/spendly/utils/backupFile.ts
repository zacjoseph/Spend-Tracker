import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { SpendlyBackup } from '@/utils/backup';

function backupFilename(exportedAt: string) {
  const date = new Date(exportedAt);
  const stamp = Number.isNaN(date.getTime())
    ? 'unknown-date'
    : date.toISOString().slice(0, 10);
  return `spendly-backup-${stamp}.json`;
}

export async function exportBackupFile(backup: SpendlyBackup): Promise<{ success: true } | { success: false; message: string }> {
  const contents = JSON.stringify(backup, null, 2);
  const filename = backupFilename(backup.exportedAt);

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      return { success: false, message: 'Download is not available in this browser.' };
    }
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }

  if (!cacheDirectory) {
    return { success: false, message: 'Could not access a folder to save the backup.' };
  }

  const uri = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(uri, contents, { encoding: 'utf8' });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Spendly backup',
      UTI: 'public.json',
    });
    return { success: true };
  }

  return { success: false, message: 'Sharing is not available on this device.' };
}

async function readUriAsText(uri: string): Promise<string | null> {
  try {
    const content = await readAsStringAsync(uri, { encoding: 'utf8' });
    if (content.trim().length > 0) return content;
  } catch {
    // Fall through to fetch-based read below.
  }

  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const content = await response.text();
    return content.trim().length > 0 ? content : null;
  } catch {
    return null;
  }
}

export async function pickBackupFile(): Promise<{ success: true; content: string } | { success: false; message: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'android'
        ? ['application/json', 'text/json', 'application/octet-stream', '*/*']
        : ['application/json', 'text/json', 'public.json'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { success: false, message: 'Import canceled.' };
    }

    const asset = result.assets[0];
    if (Platform.OS === 'web') {
      if (!asset.file) {
        return { success: false, message: 'Could not read the selected file.' };
      }
      const content = await asset.file.text();
      return content.trim().length > 0
        ? { success: true, content }
        : { success: false, message: 'The selected file is empty.' };
    }

    const uri = asset.uri;
    if (!uri) {
      return { success: false, message: 'Could not read the selected file.' };
    }

    const content = await readUriAsText(uri);
    if (!content) {
      return { success: false, message: 'Could not read the selected file. Try saving the backup to Downloads first.' };
    }

    return { success: true, content };
  } catch {
    return { success: false, message: 'Could not open the selected file.' };
  }
}
