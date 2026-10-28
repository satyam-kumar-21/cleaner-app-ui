/**
 * Validation utilities for form inputs
 */

export function validateEmail(email: string): { isValid: boolean; message?: string } {
  if (!email) {
    return { isValid: false, message: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, message: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  return { isValid: true };
}

export function validateRequired(value: string, fieldName: string): { isValid: boolean; message?: string } {
  if (!value || !value.trim()) {
    return { isValid: false, message: `${fieldName} is required` };
  }

  return { isValid: true };
}

export function validateConfirmPassword(password: string, confirmPassword: string): { isValid: boolean; message?: string } {
  if (!confirmPassword) {
    return { isValid: false, message: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, message: 'Passwords do not match' };
  }

  return { isValid: true };
}

export function validateName(name: string): { isValid: boolean; message?: string } {
  if (!name || !name.trim()) {
    return { isValid: false, message: 'Name is required' };
  }

  if (name.trim().length < 2) {
    return { isValid: false, message: 'Name must be at least 2 characters long' };
  }

  return { isValid: true };
}

/**
 * Validates multiple fields at once
 */
export function validateForm(fields: { [key: string]: any }): { isValid: boolean; errors: { [key: string]: string } } {
  const errors: { [key: string]: string } = {};
  let isValid = true;

  // Check each field
  for (const [fieldName, value] of Object.entries(fields)) {
    switch (fieldName) {
      case 'email':
        const emailResult = validateEmail(value);
        if (!emailResult.isValid) {
          errors[fieldName] = emailResult.message!;
          isValid = false;
        }
        break;
      case 'password':
        const passwordResult = validatePassword(value);
        if (!passwordResult.isValid) {
          errors[fieldName] = passwordResult.message!;
          isValid = false;
        }
        break;
      case 'name':
        const nameResult = validateName(value);
        if (!nameResult.isValid) {
          errors[fieldName] = nameResult.message!;
          isValid = false;
        }
        break;
      case 'confirmPassword':
        if (fields.password) {
          const confirmResult = validateConfirmPassword(fields.password, value);
          if (!confirmResult.isValid) {
            errors[fieldName] = confirmResult.message!;
            isValid = false;
          }
        }
        break;
    }
  }

  return { isValid, errors };
}