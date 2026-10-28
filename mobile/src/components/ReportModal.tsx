import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ReportReason, ThemePalette } from "@asterial/core";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or unwanted solicitation" },
  { value: "harassment", label: "Harassment or abusive language" },
  { value: "impersonation", label: "Impersonation" },
  { value: "illegal_content", label: "Illegal or harmful content" },
  { value: "other", label: "Other safety concern" },
];

export function ReportModal({
  visible,
  palette,
  subjectLabel,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  palette: ThemePalette;
  subjectLabel: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorText(null);
    try {
      await onSubmit(reason, details);
      setDetails("");
      onClose();
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Could not submit report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.bgSurface,
              borderColor: palette.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.danger }]}>
            SAFETY REPORT
          </Text>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            Report {subjectLabel}
          </Text>
          <Text style={[styles.desc, { color: palette.textSecondary }]}>
            Reports are stored confidentially in ASTERIAL moderation records.
          </Text>

          <View style={styles.reasonList}>
            {REASONS.map((r) => {
              const selected = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.reasonRow,
                    {
                      backgroundColor: selected
                        ? palette.accentSoft
                        : palette.bgElevated,
                      borderColor: selected
                        ? palette.accent
                        : palette.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonLabel,
                      {
                        color: selected ? palette.accent : palette.textPrimary,
                      },
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Optional context (up to 1000 characters)"
            placeholderTextColor={palette.textMuted}
            multiline
            maxLength={1000}
            style={[
              styles.input,
              {
                backgroundColor: palette.bgElevated,
                borderColor: palette.borderSubtle,
                color: palette.textPrimary,
              },
            ]}
          />

          {errorText ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>
              {errorText}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={[
                styles.secondaryBtn,
                { borderColor: palette.borderSubtle },
              ]}
            >
              <Text style={{ color: palette.textSecondary, fontWeight: "600" }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={submitting}
              style={[styles.primaryBtn, { backgroundColor: palette.danger }]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Submit Report</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    padding: 20,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: "800",
  },
  desc: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
  },
  reasonList: {
    marginTop: 14,
    gap: 7,
  },
  reasonRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 74,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: "top",
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  buttonRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13.5,
  },
});
