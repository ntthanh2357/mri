import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VAULT_KEY } from '../models/documentVault.model';

const generateId = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const loadFromStorage = async () => {
  try {
    const raw = await AsyncStorage.getItem(VAULT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const useDocumentVault = () => {
  const [vault, setVault] = useState({});
  const [loading, setLoading] = useState(true);

  const reloadVault = useCallback(async () => {
    setLoading(true);
    const data = await loadFromStorage();
    setVault(data);
    setLoading(false);
  }, []);

  const persist = useCallback(async (next) => {
    setVault(next);
    await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(next));
  }, []);

  const saveDocument = useCallback(async (type, formData, source = 'manual', imageUri = null, meta = {}) => {
    const current = await loadFromStorage();
    const now = new Date().toISOString();
    const existing = current[type] || [];
    const docId = meta.docId || generateId();
    const isEdit = existing.some((d) => d.id === docId);
    const doc = {
      id: docId,
      type,
      source,
      imageUri: imageUri || null,
      formData: formData || {},
      hospitalName: meta.hospitalName || '',
      visitDate: meta.visitDate || '',
      createdAt: isEdit ? (existing.find((d) => d.id === docId)?.createdAt || now) : now,
      updatedAt: now,
    };
    const next = {
      ...current,
      [type]: isEdit
        ? existing.map((d) => (d.id === docId ? doc : d))
        : [...existing, doc],
    };
    await persist(next);
    return doc;
  }, [persist]);

  const deleteDocument = useCallback(async (type, docId) => {
    const current = await loadFromStorage();
    const next = {
      ...current,
      [type]: (current[type] || []).filter((d) => d.id !== docId),
    };
    await persist(next);
  }, [persist]);

  const getDocsByType = useCallback((type) => vault[type] || [], [vault]);

  const getDocById = useCallback((type, docId) => {
    return (vault[type] || []).find((d) => d.id === docId) || null;
  }, [vault]);

  return { vault, loading, reloadVault, saveDocument, deleteDocument, getDocsByType, getDocById };
};
