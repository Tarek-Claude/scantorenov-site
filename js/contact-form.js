// Contact Form Validation

// Function to validate email address
function validateEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
}

// Function to validate form on submit
function validateForm(event) {
    event.preventDefault(); // Prevent form submission

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    let valid = true;
    let errorMessage = '';

    // Validate name
    if (name.trim() === '') {
        valid = false;
        errorMessage += 'Name is required.\n';
    }

    // Validate email
    if (!validateEmail(email)) {
        valid = false;
        errorMessage += 'Please enter a valid email address.\n';
    }

    // Validate message
    if (message.trim() === '') {
        valid = false;
        errorMessage += 'Message cannot be empty.\n';
    }

    if (!valid) {
        alert(errorMessage); // Display error message
    } else {
        alert('Form submitted successfully!'); // Simulate successful submission
        // Here you can proceed with form submission (e.g., via AJAX)
    }
}

// Add event listener to the form
document.getElementById('contactForm').addEventListener('submit', validateForm);