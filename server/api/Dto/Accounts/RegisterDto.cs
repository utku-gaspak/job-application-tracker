using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Account;

public class RegisterDto
{
    [Required]
    [MinLength(3, ErrorMessage = "Username must be at least 3 characters.")]
    [MaxLength(20, ErrorMessage = "Username must be at most 20 characters.")]
    public string? Username { get; set; }

    [Required]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    public string? Email { get; set; }

    [Required]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be at least 6 characters.")]
    public string? Password { get; set; }
}
