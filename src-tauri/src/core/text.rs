//! Decodes BVE text files. Many Japanese routes are saved as Shift-JIS.

/// UTF-8 first (allowing a multi-byte character cut off at the end of a
/// truncated read), then Shift-JIS, then Windows-1252.
pub fn decode(bytes: &[u8]) -> String {
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    match std::str::from_utf8(bytes) {
        Ok(text) => return text.to_string(),
        Err(err) if err.error_len().is_none() => {
            return String::from_utf8_lossy(&bytes[..err.valid_up_to()]).into_owned();
        }
        Err(_) => {}
    }
    let (text, _, had_errors) = encoding_rs::SHIFT_JIS.decode(bytes);
    if !had_errors {
        return text.into_owned();
    }
    // a truncated read may have cut a two-byte character in half
    if let Some((_, head)) = bytes.split_last() {
        let (text, _, had_errors) = encoding_rs::SHIFT_JIS.decode(head);
        if !had_errors {
            return text.into_owned();
        }
    }
    encoding_rs::WINDOWS_1252.decode(bytes).0.into_owned()
}
