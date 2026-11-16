package dev.tunahan.toolbox.grouping;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "groupings")
@Getter
@Setter
@NoArgsConstructor

public class Grouping {
    @Id
    @Column(length = 8)
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private int groupSize;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "teams", nullable = false, columnDefinition = "jsonb")
    private List<List<String>> groups;   // [["Ayşe","Can"],["Ali","Zeynep"]]

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
